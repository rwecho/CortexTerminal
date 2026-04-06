using System.Security.Claims;
using CortexTerminal.Gateway.Configuration;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Users;
using CortexTerminal.Gateway.Services.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayAuthenticationServiceCollectionExtensions
{
    public static IServiceCollection AddGatewayAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var authOptions = configuration
            .GetSection(GatewayAuthOptions.SectionName)
            .Get<GatewayAuthOptions>()
            ?? new GatewayAuthOptions();

        services.Configure<GatewayAuthOptions>(configuration.GetSection(GatewayAuthOptions.SectionName));

        services.AddIdentityCore<GatewayUser>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredLength = 8;
                options.User.RequireUniqueEmail = false;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<GatewayDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
            options.DefaultScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
        });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("GatewayUser", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireAssertion(context => context.User.HasClaim(claim => claim.Type == Claims.Subject));
            });

            options.AddPolicy("WorkerClient", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireClaim(Claims.ClientId, authOptions.WorkerClientId);
            });

            options.AddPolicy("WorkerNode", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireAssertion(context =>
                    context.User.HasClaim(claim => claim.Type == GatewayClaimTypes.WorkerId)
                    && context.User.GetScopes().Contains("worker.manage"));
            });

            options.AddPolicy("GatewayUserOrWorkerNode", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireAssertion(context =>
                    IsGatewayUser(context.User)
                    || (context.User.HasClaim(claim => claim.Type == GatewayClaimTypes.WorkerId)
                        && context.User.GetScopes().Contains("worker.manage")));
            });
        });

        services.AddOpenIddict()
            .AddCore(options =>
            {
                options.UseEntityFrameworkCore()
                    .UseDbContext<GatewayDbContext>();
            })
            .AddServer(options =>
            {
                options.SetIssuer(new Uri(authOptions.Issuer));
                options.SetTokenEndpointUris("/connect/token");

                options.AllowPasswordFlow();
                options.AllowClientCredentialsFlow();
                options.AllowCustomFlow("urn:cortex:grant-type:worker_device_code");
                options.AllowRefreshTokenFlow();
                options.AcceptAnonymousClients();

                options.RegisterScopes("gateway.api", "relay.connect", "worker.manage", Scopes.OfflineAccess);

                options.SetAccessTokenLifetime(TimeSpan.FromHours(1));
                options.SetRefreshTokenLifetime(TimeSpan.FromDays(14));

                options.AddDevelopmentEncryptionCertificate()
                    .AddDevelopmentSigningCertificate();

                options.UseAspNetCore()
                    .EnableTokenEndpointPassthrough()
                    .EnableStatusCodePagesIntegration()
                    .DisableTransportSecurityRequirement();
            })
            .AddValidation(options =>
            {
                options.SetIssuer(authOptions.Issuer);
                options.UseLocalServer();
                options.UseAspNetCore();
            });

        services.AddScoped<IGatewayAuthBootstrapper, GatewayAuthBootstrapper>();

        return services;
    }

    private static bool IsGatewayUser(ClaimsPrincipal principal)
    {
        return principal.HasClaim(claim => claim.Type == Claims.Subject)
               && !principal.HasClaim(claim => claim.Type == GatewayClaimTypes.WorkerId);
    }

    public static async Task InitializeGatewayAuthenticationAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var bootstrapper = scope.ServiceProvider.GetRequiredService<IGatewayAuthBootstrapper>();
        await bootstrapper.InitializeAsync();
    }
}