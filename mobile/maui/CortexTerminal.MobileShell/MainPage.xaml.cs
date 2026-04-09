using System.Text.Json;
using CortexTerminal.MobileShell.Services;

namespace CortexTerminal.MobileShell;

public partial class MainPage : ContentPage
{
	private readonly NativeCapabilityBridge nativeCapabilityBridge;
	private CancellationTokenSource? loadingTimeoutCts;
	private bool isInitialized;

	public MainPage(NativeCapabilityBridge nativeCapabilityBridge)
	{
		InitializeComponent();
		this.nativeCapabilityBridge = nativeCapabilityBridge;
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

	private void OnHybridWebViewLoaded(object? sender, EventArgs e)
	{
		statusMessageLabel.Text = "React terminal shell 已加载，等待 web app 初始化...";
	}

	private async void OnHybridWebViewRawMessageReceived(object? sender, HybridWebViewRawMessageReceivedEventArgs e)
	{
		if (string.IsNullOrWhiteSpace(e.Message))
		{
			return;
		}

		try
		{
			using var document = JsonDocument.Parse(e.Message);
			if (!document.RootElement.TryGetProperty("type", out var typeElement))
			{
				return;
			}

			var messageType = typeElement.GetString();

			switch (messageType)
			{
				case "appInit":
					await MainThread.InvokeOnMainThreadAsync(() =>
					{
						hybridWebView.SendRawMessage(JsonSerializer.Serialize(new
						{
							type = "initData",
							payload = nativeCapabilityBridge.CreateStartupConfigSnapshot()
						}));
						statusMessageLabel.Text = "native startup config 已下发，等待 web app 就绪...";
					});
					break;
				case "appReady":
					await MainThread.InvokeOnMainThreadAsync(async () =>
					{
						loadingTimeoutCts?.Cancel();
						statusMessageLabel.Text = "React terminal shell 已就绪，正在进入工作台...";
						await loadingOverlay.FadeToAsync(0, 220, Easing.Linear);
						loadingOverlay.IsVisible = false;
						loadingIndicator.IsRunning = false;
					});
					break;
			}
		}
		catch (JsonException)
		{
			// ignore malformed startup lifecycle messages
		}
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
