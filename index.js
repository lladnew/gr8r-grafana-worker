// v1.0.2 gr8r-grafana-worker: fixed timestamp and live base64 auth
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();
      const { level = "info", message = "No message provided", meta = {} } = body;

      const timestamp = Date.now() * 1_000_000; // current time in nanoseconds

      const stream = {
        stream: {
          level,
          source: meta.source || "unknown",
          service_name: meta.service || "unknown_service"
        },
        values: [[`${timestamp}`, message]]
      };

      const lokiUrl = env.GRAFANA_LOKI_URL;
      const username = env.GRAFANA_USERNAME;
      const apiKey = env.GRAFANA_API_KEY;
      const authHeader = 'Basic ' + btoa(`${username}:${apiKey}`);

      const response = await fetch(`${lokiUrl}/loki/api/v1/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify({ streams: [stream] })
      });

      const responseBody = await response.text();

      if (!response.ok) {
        return new Response(`Loki error: ${responseBody}`, { status: 500 });
      }

      return new Response("Log pushed to Grafana Loki successfully", {
        headers: { "Content-Type": "text/plain" }
      });
    } catch (err) {
      return new Response(`Unexpected error: ${err.message}`, { status: 500 });
    }
  }
}

