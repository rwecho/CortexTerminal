using CortexTerminal.Gateway.Models.Auth;
using CortexTerminal.Gateway.Models.Audit;
using CortexTerminal.Gateway.Models.Sessions;
using CortexTerminal.Gateway.Models.Users;
using CortexTerminal.Gateway.Models.Workers;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Data;

public sealed class GatewayDbContext(DbContextOptions<GatewayDbContext> options)
    : IdentityDbContext<GatewayUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<WorkerDeviceAuthorizationRecord> WorkerDeviceAuthorizations => Set<WorkerDeviceAuthorizationRecord>();

    public DbSet<AuditEntryRecord> AuditEntries => Set<AuditEntryRecord>();

    public DbSet<GatewaySessionRecord> Sessions => Set<GatewaySessionRecord>();

    public DbSet<WorkerNodeRecord> Workers => Set<WorkerNodeRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<GatewayUser>(entity =>
        {
            entity.ToTable("Users");
            entity.Property(user => user.UserName).HasColumnName("Username").HasMaxLength(100);
            entity.Property(user => user.NormalizedUserName).HasColumnName("NormalizedUsername").HasMaxLength(100);
            entity.Property(user => user.DisplayName).HasMaxLength(200);
            entity.Property(user => user.Email).HasMaxLength(200);
            entity.Property(user => user.NormalizedEmail).HasMaxLength(200);
            entity.Property(user => user.PasswordHash);
            entity.Property(user => user.SecurityStamp).HasMaxLength(200);
            entity.Property(user => user.ConcurrencyStamp).HasMaxLength(200);
            entity.Property(user => user.PhoneNumber).HasMaxLength(32);
            entity.HasIndex(user => user.NormalizedUserName).IsUnique();
        });

        modelBuilder.Entity<IdentityRole<Guid>>().ToTable("AuthRoles");
        modelBuilder.Entity<IdentityRoleClaim<Guid>>().ToTable("AuthRoleClaims");
        modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("AuthUserClaims");
        modelBuilder.Entity<IdentityUserLogin<Guid>>().ToTable("AuthUserLogins");
        modelBuilder.Entity<IdentityUserRole<Guid>>().ToTable("AuthUserRoles");
        modelBuilder.Entity<IdentityUserToken<Guid>>().ToTable("AuthUserTokens");

        modelBuilder.Entity<WorkerDeviceAuthorizationRecord>(entity =>
        {
            entity.ToTable("WorkerDeviceAuthorizations");
            entity.HasKey(record => record.Id);
            entity.Property(record => record.DeviceCode).HasMaxLength(256);
            entity.Property(record => record.UserCode).HasMaxLength(32);
            entity.Property(record => record.WorkerId).HasMaxLength(120);
            entity.Property(record => record.WorkerDisplayName).HasMaxLength(200);
            entity.Property(record => record.RequestedScopes).HasMaxLength(500);
            entity.Property(record => record.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(record => record.ApprovedByDisplayName).HasMaxLength(200);

            entity.HasIndex(record => record.DeviceCode).IsUnique();
            entity.HasIndex(record => record.UserCode).IsUnique();
            entity.HasIndex(record => record.WorkerId);
            entity.HasIndex(record => record.Status);

            entity.HasOne<GatewayUser>()
                .WithMany()
                .HasForeignKey(record => record.ApprovedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AuditEntryRecord>(entity =>
        {
            entity.ToTable("AuditEntries");
            entity.HasKey(entry => entry.Id);
            entity.Property(entry => entry.Category).HasMaxLength(64);
            entity.Property(entry => entry.Kind).HasMaxLength(64);
            entity.Property(entry => entry.Summary).HasMaxLength(300);
            entity.Property(entry => entry.ActorType).HasMaxLength(32);
            entity.Property(entry => entry.ActorId).HasMaxLength(200);
            entity.Property(entry => entry.SessionId).HasMaxLength(120);
            entity.Property(entry => entry.WorkerId).HasMaxLength(120);
            entity.Property(entry => entry.TraceId).HasMaxLength(120);

            entity.HasIndex(entry => entry.CreatedAtUtc);
            entity.HasIndex(entry => entry.Category);
            entity.HasIndex(entry => entry.SessionId);
            entity.HasIndex(entry => entry.WorkerId);
        });

        modelBuilder.Entity<WorkerNodeRecord>(entity =>
        {
            entity.HasKey(worker => worker.WorkerId);
            entity.Property(worker => worker.WorkerId).HasMaxLength(120);
            entity.Property(worker => worker.DisplayName).HasMaxLength(200);
            entity.Property(worker => worker.ModelName).HasMaxLength(120);
            entity.Property(worker => worker.AvailablePathsJson);
            entity.Property(worker => worker.CurrentConnectionId).HasMaxLength(200);
            entity.Property(worker => worker.State).HasConversion<string>().HasMaxLength(32);
        });

        modelBuilder.Entity<GatewaySessionRecord>(entity =>
        {
            entity.HasKey(session => session.SessionId);
            entity.Property(session => session.SessionId).HasMaxLength(120);
            entity.Property(session => session.WorkerId).HasMaxLength(120);
            entity.Property(session => session.DisplayName).HasMaxLength(200);
            entity.Property(session => session.WorkingDirectory).HasMaxLength(1000);
            entity.Property(session => session.MobileConnectionId).HasMaxLength(200);
            entity.Property(session => session.TraceId).HasMaxLength(120);
            entity.Property(session => session.State).HasConversion<string>().HasMaxLength(32);

            entity.HasOne<GatewayUser>()
                .WithMany()
                .HasForeignKey(session => session.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne<WorkerNodeRecord>()
                .WithMany()
                .HasForeignKey(session => session.WorkerId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(session => session.UserId);
            entity.HasIndex(session => session.WorkerId);
            entity.HasIndex(session => session.State);
        });
    }
}
