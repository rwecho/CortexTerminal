namespace CortexTerminal.MobileShell;

public partial class AppShell : Shell
{
	public AppShell(MainPage mainPage)
	{
		InitializeComponent();

		Items.Add(new ShellContent
		{
			Route = nameof(MainPage),
			Content = mainPage
		});
	}
}
