FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore layer — only re-runs when .csproj files change
COPY ["src/Omi.Api/Omi.Api.csproj",               "src/Omi.Api/"]
COPY ["src/Omi.Application/Omi.Application.csproj","src/Omi.Application/"]
COPY ["src/Omi.Domain/Omi.Domain.csproj",          "src/Omi.Domain/"]
COPY ["src/Omi.Infrastructure/Omi.Infrastructure.csproj","src/Omi.Infrastructure/"]
RUN dotnet restore "src/Omi.Api/Omi.Api.csproj"

# Build layer
COPY . .
WORKDIR "/src/src/Omi.Api"
RUN dotnet build "Omi.Api.csproj" -c Release -o /app/build --no-restore

# Publish layer
FROM build AS publish
RUN dotnet publish "Omi.Api.csproj" -c Release -o /app/publish --no-restore

# Final image — runtime only, no SDK
FROM base AS final
WORKDIR /app

# .NET chiseled images ship a built-in non-root 'app' user (UID 1654).
# --chown at COPY time avoids needing adduser/chmod (both absent in chiseled).
COPY --from=publish --chown=app:app /app/publish .
USER app

ENTRYPOINT ["dotnet", "Omi.Api.dll"]
