using CortexTerminal.MobileShell.Services;

namespace CortexTerminal.MobileShell;

public partial class MainPage : ContentPage
{
	private CancellationTokenSource? loadingTimeoutCts;
	private bool isInitialized;

	public MainPage(NativeCapabilityBridge nativeCapabilityBridge)
	{
		InitializeComponent();
		hybridWebView.SetInvokeJavaScriptTarget(nativeCapabilityBridge);
	}

	protected override void OnAppearing()
	{
		base.OnAppearing();

		if (isInitialized)
		{
			return;
		}

		isInitialized = true;
		statusMessageLabel.Text = "正在挂载 Cortex Terminal shell...";
		StartLoadingTimeout();
	}

	protected override void OnDisappearing()
	{
		loadingTimeoutCts?.Cancel();
		loadingTimeoutCts = null;
		base.OnDisappearing();
	}

	private async void OnHybridWebViewLoaded(object? sender, EventArgs e)
	{
		loadingTimeoutCts?.Cancel();
		statusMessageLabel.Text = "React terminal shell 已加载，正在进入工作台...";
		await loadingOverlay.FadeToAsync(0, 220, Easing.Linear);
		loadingOverlay.IsVisible = false;
		loadingIndicator.IsRunning = false;
	}

	private void StartLoadingTimeout()
	{
		loadingTimeoutCts?.Cancel();
		loadingTimeoutCts = new CancellationTokenSource();
		var token = loadingTimeoutCts.Token;

		Task.Run(async () =>
		{
			try
			{
				await Task.Delay(TimeSpan.FromSeconds(8), token);

				MainThread.BeginInvokeOnMainThread(() =>
				{
					if (!loadingOverlay.IsVisible)
					{
						return;
					}

					loadingIndicator.IsRunning = false;
					statusMessageLabel.Text = "HybridWebView 启动超时。请先执行 npm run build:maui-shell，或检查 wwwroot 资产是否已同步。";
				});
			}
			catch (TaskCanceledException)
			{
				// no-op
			}
		});
	}
}
