using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CortexTerminal.Gateway.Data.Migrations
{
    /// <inheritdoc />
    public partial class WorkerDeviceAuthorization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkerDeviceAuthorizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceCode = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    UserCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    WorkerId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    WorkerDisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RequestedScopes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PollingIntervalSeconds = table.Column<int>(type: "integer", nullable: false),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByDisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RedeemedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastPolledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkerDeviceAuthorizations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkerDeviceAuthorizations_Users_ApprovedByUserId",
                        column: x => x.ApprovedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkerDeviceAuthorizations_ApprovedByUserId",
                table: "WorkerDeviceAuthorizations",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerDeviceAuthorizations_DeviceCode",
                table: "WorkerDeviceAuthorizations",
                column: "DeviceCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkerDeviceAuthorizations_Status",
                table: "WorkerDeviceAuthorizations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerDeviceAuthorizations_UserCode",
                table: "WorkerDeviceAuthorizations",
                column: "UserCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkerDeviceAuthorizations_WorkerId",
                table: "WorkerDeviceAuthorizations",
                column: "WorkerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkerDeviceAuthorizations");
        }
    }
}
