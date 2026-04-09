namespace CortexTerminal.MobileShell.Options;

public sealed class StartupConfigOptions
{
    public const string SectionName = "StartupConfig";

    public string GatewayUrl { get; set; } = string.Empty;

    public bool UseHashRouter { get; set; } = true;

    public bool IsNativeShell { get; set; } = true;
}