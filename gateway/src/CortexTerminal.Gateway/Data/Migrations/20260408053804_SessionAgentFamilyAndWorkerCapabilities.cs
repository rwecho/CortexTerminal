using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CortexTerminal.Gateway.Data.Migrations
{
    /// <inheritdoc />
    public partial class SessionAgentFamilyAndWorkerCapabilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SupportedAgentFamiliesJson",
                table: "Workers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AgentFamily",
                table: "Sessions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SupportedAgentFamiliesJson",
                table: "Workers");

            migrationBuilder.DropColumn(
                name: "AgentFamily",
                table: "Sessions");
        }
    }
}
