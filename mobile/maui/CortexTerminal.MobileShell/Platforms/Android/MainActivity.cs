using Android.App;
using Android.Graphics;
using Android.Content.PM;
using Android.OS;
using Android.Views;
using AndroidX.Core.View;
using AndroidColor = Android.Graphics.Color;

namespace CortexTerminal.MobileShell;

[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTop, ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    private static readonly AndroidColor ShellBackgroundColor = AndroidColor.ParseColor("#050505");

    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        ApplySystemBarColors();
    }

    protected override void OnResume()
    {
        base.OnResume();
        ApplySystemBarColors();
    }

    private void ApplySystemBarColors()
    {
        if (Window is null)
        {
            return;
        }

        Window.SetStatusBarColor(ShellBackgroundColor);
        Window.SetNavigationBarColor(ShellBackgroundColor);
        Window.DecorView.SetBackgroundColor(ShellBackgroundColor);

        var controller = WindowCompat.GetInsetsController(Window, Window.DecorView);
        if (controller is null)
        {
            return;
        }

        controller.AppearanceLightStatusBars = false;
        controller.AppearanceLightNavigationBars = false;
        controller.SystemBarsBehavior = WindowInsetsControllerCompat.BehaviorShowTransientBarsBySwipe;
    }
}
