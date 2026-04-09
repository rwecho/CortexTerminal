using System.Security.Claims;
using System.Text;
using CortexTerminal.Gateway.Contracts.Auth;
using CortexTerminal.Gateway.Models.Users;
using CortexTerminal.Gateway.Services.Auth;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayWorkerInstallEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapGatewayWorkerInstallEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/install-worker.sh", (HttpContext httpContext) =>
        {
            var token = httpContext.Request.Query["token"].ToString().Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return Results.BadRequest("token is required.");
            }

            var gatewayBaseUrl = BuildGatewayBaseUrl(httpContext.Request);
            var script = WorkerInstallScriptBuilder.Build(gatewayBaseUrl, token);
            return Results.Text(script, "application/x-sh", Encoding.UTF8);
        });

        endpoints.MapPost("/api/worker/install/registration-key", async (
            WorkerInstallBootstrapRequest request,
            IWorkerInstallTokenService workerInstallTokenService,
            IWorkerRegistrationKeyService workerRegistrationKeyService,
            CancellationToken cancellationToken) =>
        {
            var consumedToken = await workerInstallTokenService.ConsumeAsync(request.Token, cancellationToken);
            if (consumedToken is null)
            {
                return Results.BadRequest(new { message = "Install token is invalid, expired, or already used." });
            }

            var registrationKey = await workerRegistrationKeyService.IssueAsync(consumedToken.User, cancellationToken);
            return Results.Text(registrationKey.RegistrationKey, "text/plain", Encoding.UTF8);
        });

        var auth = endpoints.MapGroup("/api/auth/worker").WithTags("Gateway Worker Install");
        auth.MapPost("/install-token", async (
            HttpContext httpContext,
            ClaimsPrincipal principal,
            UserManager<GatewayUser> userManager,
            IWorkerInstallTokenService workerInstallTokenService,
            CancellationToken cancellationToken) =>
        {
            var subject = principal.GetClaim(Claims.Subject);
            if (!Guid.TryParse(subject, out var userId))
            {
                return Results.Unauthorized();
            }

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null)
            {
                return Results.Unauthorized();
            }

            var result = await workerInstallTokenService.IssueAsync(user, cancellationToken);
            var gatewayBaseUrl = BuildGatewayBaseUrl(httpContext.Request);
            var installUrl = $"{gatewayBaseUrl}/install-worker.sh?token={Uri.EscapeDataString(result.Token)}";
            return Results.Ok(new WorkerInstallTokenResponse(
                result.Token,
                result.IssuedAtUtc,
                result.ExpiresAtUtc,
                installUrl,
                $"curl -fsSL '{installUrl}' | bash"));
        }).RequireAuthorization("GatewayUser");

        return endpoints;
    }

    private static string BuildGatewayBaseUrl(HttpRequest request)
    {
        return $"{request.Scheme}://{request.Host}{request.PathBase}".TrimEnd('/');
    }

    private sealed record WorkerInstallBootstrapRequest(string Token);
}

internal static class WorkerInstallScriptBuilder
{
    private const string DefaultPackageBaseUrl = "https://github.com/rwecho/CortexTerminal/releases/latest/download";

    public static string Build(string gatewayBaseUrl, string token)
    {
        return string.Join("\n",
        [
            "#!/usr/bin/env bash",
            "set -euo pipefail",
            string.Empty,
            $"gateway_base_url={ShellEscape(gatewayBaseUrl)}",
            $"install_token={ShellEscape(token)}",
            "install_dir=\"${CORTEX_WORKER_INSTALL_DIR:-$HOME/.cortex-terminal/worker}\"",
            "package_base_url=\"${CORTEX_WORKER_PACKAGE_BASE_URL:-" + DefaultPackageBaseUrl + "}\"",
            "force_install=\"${CORTEX_WORKER_INSTALL_FORCE:-true}\"",
            string.Empty,
            "log() {",
            "  printf '[cortex-worker-install] %s\\n' \"$1\"",
            "}",
            string.Empty,
            "fail() {",
            "  printf '[cortex-worker-install] ERROR: %s\\n' \"$1\" >&2",
            "  exit 1",
            "}",
            string.Empty,
            "require_command() {",
            "  command -v \"$1\" >/dev/null 2>&1 || fail \"missing required command: $1\"",
            "}",
            string.Empty,
            "random_suffix() {",
            "  hexdump -n 4 -e '4/1 \"%02x\"' /dev/urandom | cut -c 1-6",
            "}",
            string.Empty,
            "normalize_hostname() {",
            "  local host_name",
            "  host_name=\"$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo worker)\"",
            "  printf '%s' \"$host_name\" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-'",
            "}",
            string.Empty,
            "resolve_asset() {",
            "  local os_name arch_name",
            "  os_name=\"$(uname -s)\"",
            "  arch_name=\"$(uname -m)\"",
            string.Empty,
            "  case \"$os_name/$arch_name\" in",
            "    Darwin/arm64)",
            "      printf 'cortex-terminal-worker-osx-arm64.tar.gz osx-arm64'",
            "      ;;",
            "    Linux/x86_64)",
            "      printf 'cortex-terminal-worker-linux-x64.tar.gz linux-x64'",
            "      ;;",
            "    *)",
            "      fail \"unsupported platform: $os_name/$arch_name\"",
            "      ;;",
            "  esac",
            "}",
            string.Empty,
            "require_command curl",
            "require_command tar",
            "require_command hexdump",
            string.Empty,
            "bootstrap_payload=\"{\\\"token\\\":\\\"${install_token}\\\"}\"",
            "log \"requesting worker registration key\"",
            "worker_registration_key=\"$(curl -fsSL \"$gateway_base_url/api/worker/install/registration-key\" \\",
            "  -H 'Content-Type: application/json' \\",
            "  -X POST \\",
            "  --data \"$bootstrap_payload\")\"",
            string.Empty,
            "if [[ -z \"$worker_registration_key\" ]]; then",
            "  fail 'gateway returned an empty registration key'",
            "fi",
            string.Empty,
            "read -r worker_asset_name worker_package_dir <<<\"$(resolve_asset)\"",
            "package_url=\"$package_base_url/$worker_asset_name\"",
            "temp_dir=\"$(mktemp -d)\"",
            "archive_path=\"$temp_dir/$worker_asset_name\"",
            "trap 'rm -rf \"$temp_dir\"' EXIT",
            string.Empty,
            "log \"downloading worker package from $package_url\"",
            "curl -fsSL \"$package_url\" -o \"$archive_path\"",
            "log \"extracting worker package\"",
            "tar -xzf \"$archive_path\" -C \"$temp_dir\"",
            string.Empty,
            "package_root=\"$temp_dir/$worker_package_dir\"",
            "install_script=\"$package_root/scripts/install-worker.sh\"",
            "[[ -x \"$install_script\" ]] || chmod +x \"$install_script\"",
            string.Empty,
            "if [[ \"$force_install\" == \"true\" ]]; then",
            "  \"$install_script\" --force",
            "else",
            "  \"$install_script\"",
            "fi",
            string.Empty,
            "worker_name=\"$(normalize_hostname)-$(random_suffix)\"",
            "config_dir=\"$install_dir/config\"",
            "env_file=\"$config_dir/worker.env\"",
            "mkdir -p \"$config_dir\"",
            string.Empty,
            "cat >\"$env_file\" <<EOF",
            "# Managed by Cortex Terminal install-worker.sh",
            "GATEWAY_BASE_URL=$gateway_base_url",
            "WORKER_ID=$worker_name",
            "WORKER_DISPLAY_NAME=$worker_name",
            "WORKER_AVAILABLE_PATHS=$HOME",
            "WORKER_USER_KEY=$worker_registration_key",
            "WORKER_LOG_LEVEL=Information",
            "WORKER_HEARTBEAT_INTERVAL_SECONDS=30",
            "WORKER_SESSION_IDLE_TIMEOUT_SECONDS=1200",
            "WORKER_SESSION_DISCONNECTED_GRACE_SECONDS=120",
            "WORKER_SESSION_SWEEP_INTERVAL_SECONDS=30",
            "WORKER_CLOSE_GATEWAY_SESSION_ON_CLEANUP=true",
            "EOF",
            string.Empty,
            "log \"worker installed to $install_dir\"",
            "log \"starting worker $worker_name\"",
            "exec \"$install_dir/run-worker.sh\""
        ]);
    }

    private static string ShellEscape(string value)
    {
        return $"'{value.Replace("'", "'\"'\"'")}'";
    }
}
