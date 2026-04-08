FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["gateway/src/CortexTerminal.Gateway/CortexTerminal.Gateway.csproj", "gateway/src/CortexTerminal.Gateway/"]
RUN dotnet restore "gateway/src/CortexTerminal.Gateway/CortexTerminal.Gateway.csproj"

COPY gateway/src/CortexTerminal.Gateway/. "gateway/src/CortexTerminal.Gateway/"
WORKDIR /src/gateway/src/CortexTerminal.Gateway
RUN dotnet publish "CortexTerminal.Gateway.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:5050
EXPOSE 5050
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CortexTerminal.Gateway.dll"]
