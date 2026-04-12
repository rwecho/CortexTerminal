using CommunityToolkit.Maui;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Plugin.Maui.Audio;
using CortexTerminal.MobileShell.Services;
using CortexTerminal.MobileShell.Options;
using System.Reflection;

namespace CortexTerminal.MobileShell;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		ConfigureAppSettings(builder);

		builder
			.UseMauiApp<App>()
			.UseMauiCommunityToolkit()
			.AddAudio(configureRecordingOptions: options =>
			{
#if IOS || MACCATALYST
				options.Category = AVFoundation.AVAudioSessionCategory.PlayAndRecord;
				options.Mode = AVFoundation.AVAudioSessionMode.Default;
				options.CategoryOptions = AVFoundation.AVAudioSessionCategoryOptions.MixWithOthers;
#endif
			})
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

		builder.Services
			.AddOptions<StartupConfigOptions>()
			.Bind(builder.Configuration.GetSection(StartupConfigOptions.SectionName));

		builder.Services.AddSingleton<MainPage>();
		builder.Services.AddSingleton<AppShell>();
		builder.Services.AddSingleton<NativeManagementRealtimeService>();
		builder.Services.AddSingleton<NativeCapabilityBridge>();

#if DEBUG
		builder.Services.AddHybridWebViewDeveloperTools();
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}

	private static void ConfigureAppSettings(MauiAppBuilder builder)
	{
		using var appSettingsStream = Assembly
			.GetExecutingAssembly()
			.GetManifestResourceStream("CortexTerminal.MobileShell.appsettings.json")
			?? throw new InvalidOperationException("Unable to load CortexTerminal.MobileShell appsettings.json.");

		builder.Configuration.AddJsonStream(appSettingsStream);
	}
}
