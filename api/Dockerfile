# Build the Go service with the version declared by the project.
FROM golang:1.26.10-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY api ./api
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/calculator-api ./api/cmd/server

# Keep the runtime image small and run the service as an unprivileged user.
FROM alpine:3.22
RUN addgroup -S app && adduser -S -G app -u 10001 app
COPY --from=build /out/calculator-api /usr/local/bin/calculator-api

USER app:app
ENV API_ADDRESS=:8080
EXPOSE 8080
ENTRYPOINT ["calculator-api"]
