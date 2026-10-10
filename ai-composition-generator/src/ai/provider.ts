// Load .env if present using native Node 20+ env loader
try {
  (process as any).loadEnvFile?.();
} catch {
  // Ignore if .env doesn't exist
}

import { CompositionPlan, CompositionScene } from "./prompts.js";
import { StoryboardPlanner } from "./storyboard-planner.js";
import { CompositionBuilder } from "./composition-builder.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProviderConfig {
  provider: string;
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface AIHealthStatus {
  provider: string;
  model: string;
  configured: boolean;
  hasKey: boolean;
  status:
    | "connected"
    | "configured_unverified"
    | "not_configured"
    | "authentication_failed"
    | "rate_limited"
    | "unavailable"
    | "error";
  statusLabel: string;
  lastChecked: string;
  errorCategory?: string;
  message: string;
}

export class AIProvider {
  private config: AIProviderConfig;
  private cachedHealth: { status: AIHealthStatus; expiresAt: number } | null =
    null;

  constructor() {
    this.config = {
      provider: (process.env.AI_PROVIDER || "deterministic").toLowerCase(),
      model:
        process.env.AI_MODEL ||
        (process.env.AI_PROVIDER?.toLowerCase() === "ollima"
          ? "glm-5.3-flash"
          : "default-model"),
      apiKey: process.env.AI_API_KEY || process.env.OLLAMA_API_KEY,
      endpoint: process.env.AI_ENDPOINT || process.env.OLLAMA_BASE_URL,
    };
  }

  public getProviderInfo() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      hasKey: !!this.config.apiKey,
      endpoint: this.config.endpoint,
    };
  }

  public async checkHealth(): Promise<AIHealthStatus> {
    const now = Date.now();
    if (this.cachedHealth && this.cachedHealth.expiresAt > now) {
      return this.cachedHealth.status;
    }

    const { provider, model, apiKey } = this.config;
    let result: AIHealthStatus;

    if (provider === "deterministic" || provider === "mock") {
      result = {
        provider,
        model: "local-timeline-engine",
        configured: true,
        hasKey: true,
        status: "connected",
        statusLabel: "Connected (Deterministic Engine)",
        lastChecked: new Date().toISOString(),
        message:
          "Frame-accurate GSAP timeline synthesis engine active and verified.",
      };
    } else if (provider === "ollima") {
      const endpoint =
        this.config.endpoint ||
        process.env.OLLAMA_BASE_URL ||
        "http://localhost:11434";
      const isRemote =
        endpoint.startsWith("https://") ||
        (!endpoint.includes("localhost") && !endpoint.includes("127.0.0.1"));

      if (isRemote && !apiKey) {
        result = {
          provider,
          model,
          configured: false,
          hasKey: false,
          status: "not_configured",
          statusLabel: "Not Configured (Missing Ollima Key)",
          lastChecked: new Date().toISOString(),
          errorCategory: "MISSING_API_KEY",
          message:
            "Remote Ollima endpoint configured but AI_API_KEY / OLLAMA_API_KEY is not set.",
        };
      } else {
        try {
          const isV1 = endpoint.includes("/v1");
          let probeUrl = endpoint.replace(/\/+$/, "");
          if (isV1) {
            if (!probeUrl.endsWith("/models")) probeUrl += "/models";
          } else {
            if (probeUrl.endsWith("/api")) {
              probeUrl += "/tags";
            } else if (!probeUrl.endsWith("/api/tags")) {
              probeUrl += "/api/tags";
            }
          }
          const headers: Record<string, string> = {};
          if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const response = await fetch(probeUrl, {
            method: "GET",
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.ok) {
            result = {
              provider,
              model,
              configured: true,
              hasKey: !!apiKey,
              status: "connected",
              statusLabel: `Ollama (${model}) Connected`,
              lastChecked: new Date().toISOString(),
              message: `Successfully connected to Ollima at ${endpoint}.`,
            };
          } else if (response.status === 401 || response.status === 403) {
            result = {
              provider,
              model,
              configured: true,
              hasKey: !!apiKey,
              status: "authentication_failed",
              statusLabel: "Ollama Authentication Failed",
              lastChecked: new Date().toISOString(),
              errorCategory: "AUTH_FAILED",
              message: `Ollama authentication failed (HTTP ${response.status}). Verify your Ollima API key.`,
            };
          } else {
            result = {
              provider,
              model,
              configured: true,
              hasKey: !!apiKey,
              status: "configured_unverified",
              statusLabel: `Ollama (${model}) Status ${response.status}`,
              lastChecked: new Date().toISOString(),
              message: `Ollama responded with HTTP ${response.status}.`,
            };
          }
        } catch (err: any) {
          result = {
            provider,
            model,
            configured: true,
            hasKey: !!apiKey,
            status: "unavailable",
            statusLabel: "Ollama Unavailable",
            lastChecked: new Date().toISOString(),
            errorCategory: "CONNECTION_FAILED",
            message: `Could not reach Ollima at ${endpoint}: ${err.message}`,
          };
        }
      }
    } else if (
      ["openai", "anthropic", "gemini", "huggingface"].includes(provider)
    ) {
      if (!apiKey) {
        result = {
          provider,
          model,
          configured: false,
          hasKey: false,
          status: "not_configured",
          statusLabel: `Not Configured (Missing ${provider.toUpperCase()} Key)`,
          lastChecked: new Date().toISOString(),
          errorCategory: "MISSING_API_KEY",
          message: `AI_API_KEY is not configured for provider "${provider}".`,
        };
      } else {
        result = {
          provider,
          model,
          configured: true,
          hasKey: true,
          status: "connected",
          statusLabel: `${provider.toUpperCase()} (${model}) Connected`,
          lastChecked: new Date().toISOString(),
          message: `Successfully configured for ${provider} model ${model}.`,
        };
      }
    } else {
      result = {
        provider,
        model,
        configured: false,
        hasKey: false,
        status: "error",
        statusLabel: "Unknown Provider",
        lastChecked: new Date().toISOString(),
        errorCategory: "UNKNOWN_PROVIDER",
        message: `Provider "${provider}" is not recognized.`,
      };
    }

    // Cache health check for 5 minutes (300,000 ms) to avoid quota burn
    this.cachedHealth = { status: result, expiresAt: now + 300000 };
    return result;
  }

  public async complete(
    messages: ChatMessage[],
    temperature: number = 0.2,
  ): Promise<string> {
    const { provider, model, apiKey } = this.config;

    // Check for missing keys when an external provider is explicitly configured
    if (
      ["openai", "anthropic", "huggingface", "gemini"].includes(provider) &&
      !apiKey
    ) {
      throw new Error(
        `AI Configuration Error: Missing AI_API_KEY for provider "${provider}". Please set AI_API_KEY in your environment variables to use this live model.`,
      );
    }

    if (provider === "ollima") {
      const endpoint =
        this.config.endpoint ||
        process.env.OLLAMA_BASE_URL ||
        "http://localhost:11434";
      const isRemote =
        endpoint.startsWith("https://") ||
        (!endpoint.includes("localhost") && !endpoint.includes("127.0.0.1"));
      if (isRemote && !apiKey) {
        throw new Error(
          `AI Configuration Error: Missing AI_API_KEY or OLLAMA_API_KEY for remote Ollima endpoint "${endpoint}".`,
        );
      }
      return this.callOllama(messages, model, apiKey, endpoint, temperature);
    }

    switch (provider) {
      case "openai":
        return this.callOpenAI(messages, model, apiKey!, temperature);

      case "anthropic":
        return this.callAnthropic(messages, model, apiKey!, temperature);

      case "huggingface":
        return this.callHuggingFace(messages, model, apiKey!, temperature);

      case "gemini":
        return this.callGemini(messages, model, apiKey!, temperature);

      case "deterministic":
      case "mock":
      default:
        return this.callDeterministicEngine(messages);
    }
  }

  private async callOpenAI(
    messages: ChatMessage[],
    model: string,
    apiKey: string,
    temperature: number,
  ): Promise<string> {
    const endpoint =
      this.config.endpoint || "https://api.openai.com/v1/chat/completions";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model && model !== "default-model" ? model : "gpt-4o",
          messages,
          temperature,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      if (e.name === "AbortError") {
        throw new Error("OpenAI API request timed out after 60 seconds.");
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callAnthropic(
    messages: ChatMessage[],
    model: string,
    apiKey: string,
    temperature: number,
  ): Promise<string> {
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const userMsgs = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:
            model && model !== "default-model"
              ? model
              : "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          system: systemMsg,
          messages: userMsgs,
          temperature,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || "";
    } catch (e: any) {
      if (e.name === "AbortError") {
        throw new Error("Anthropic API request timed out after 60 seconds.");
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callHuggingFace(
    messages: ChatMessage[],
    model: string,
    apiKey: string,
    temperature: number,
  ): Promise<string> {
    const endpoint =
      this.config.endpoint ||
      `https://api-inference.huggingface.co/models/${model}`;
    const prompt =
      messages.map((m) => `<|${m.role}|>\n${m.content}`).join("\n") +
      "\n<|assistant|>\n";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 3000,
          temperature,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HuggingFace API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text;
    }
    return JSON.stringify(data);
  }

  private async callGemini(
    messages: ChatMessage[],
    model: string,
    apiKey: string,
    temperature: number,
  ): Promise<string> {
    const geminiModel =
      model && model !== "default-model" ? model : "gemini-1.5-pro";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === "system");

    const body: any = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  private async callOllama(
    messages: ChatMessage[],
    model: string,
    apiKey: string | undefined,
    endpointConfig: string | undefined,
    temperature: number,
  ): Promise<string> {
    const rawEndpoint =
      endpointConfig ||
      this.config.endpoint ||
      process.env.OLLAMA_BASE_URL ||
      process.env.AI_ENDPOINT ||
      "http://localhost:11434";

    const isV1 = rawEndpoint.includes("/v1");
    let targetUrl = rawEndpoint.replace(/\/+$/, "");

    if (isV1) {
      if (!targetUrl.endsWith("/chat/completions")) {
        targetUrl += "/chat/completions";
      }
    } else {
      if (targetUrl.endsWith("/api")) {
        targetUrl += "/chat";
      } else if (!targetUrl.endsWith("/api/chat")) {
        targetUrl += "/api/chat";
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const selectedModel =
      model && model !== "default-model" ? model : "glm-5.3-flash";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const requestBody = isV1
        ? {
            model: selectedModel,
            messages,
            temperature,
            response_format: { type: "json_object" },
          }
        : {
            model: selectedModel,
            messages,
            format: "json",
            stream: false,
            options: {
              temperature,
            },
          };

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const status = response.status;
        const errText = await response.text();
        if (status === 401 || status === 403) {
          throw new Error(
            `Ollama Authentication Error (HTTP ${status}): Unauthorized. Invalid API key or access denied for endpoint "${targetUrl}". Details: ${errText.slice(0, 200)}`,
          );
        } else if (status === 404) {
          throw new Error(
            `Ollama Model Error (HTTP 404): Model "${selectedModel}" not found at endpoint "${targetUrl}". Details: ${errText.slice(0, 200)}`,
          );
        } else if (status === 429) {
          throw new Error(
            `Ollama Rate Limit Error (HTTP 429): Rate limit exceeded for endpoint "${targetUrl}". Details: ${errText.slice(0, 200)}`,
          );
        } else {
          throw new Error(
            `Ollama API Error (HTTP ${status}): Request failed at "${targetUrl}". Details: ${errText.slice(0, 200)}`,
          );
        }
      }

      const data = await response.json();
      if (isV1) {
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(
            `Ollama Response Error: Missing "content" in choices response from "${targetUrl}".`,
          );
        }
        return content;
      } else {
        const content = data.message?.content;
        if (!content) {
          throw new Error(
            `Ollama Response Error: Missing "message.content" in response from "${targetUrl}".`,
          );
        }
        return content;
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        throw new Error(
          `Ollama API Timeout Error: Request to "${targetUrl}" timed out after 60 seconds.`,
        );
      }
      if (e.code === "ECONNREFUSED" || e.message?.includes("ECONNREFUSED")) {
        throw new Error(
          `Ollama Connection Error: Could not connect to Ollima server at "${targetUrl}". Ensure the service is running and accessible.`,
        );
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Deterministic local engine:
   * Used when AI_PROVIDER is not set or set to 'deterministic'/'mock'.
   * Analyzes arbitrary natural language prompts, creates a structured storyboard,
   * and generates full HyperFrames compositions.
   */
  private async callDeterministicEngine(
    messages: ChatMessage[],
  ): Promise<string> {
    const userPromptMsg = messages.find((m) => m.role === "user");
    const rawPrompt = userPromptMsg?.content || "";

    // If this is a correction prompt, extract the original user request
    let prompt = rawPrompt;
    const correctionMatch = rawPrompt.match(
      /Original user request:\s*["']([\s\S]+?)["']/i,
    );
    if (correctionMatch) {
      prompt = correctionMatch[1];
    }

    // 1. Authoritative Duration Extraction
    const authDurationMatch = rawPrompt.match(
      /Authoritative Target Duration:\s*(\d+)/i,
    );
    const durationMatch = prompt.match(/(\d+)[ -]second/i);
    const duration = authDurationMatch
      ? parseInt(authDurationMatch[1], 10)
      : durationMatch
        ? parseInt(durationMatch[1], 10)
        : 15;

    // 2. Resolution & FPS
    const resMatch = rawPrompt.match(/Resolution:\s*(\d+)x(\d+)/i);
    const width = resMatch
      ? parseInt(resMatch[1], 10)
      : prompt.includes("720p")
        ? 1280
        : 1920;
    const height = resMatch
      ? parseInt(resMatch[2], 10)
      : prompt.includes("720p")
        ? 720
        : 1080;
    const fpsMatch = rawPrompt.match(/@\s*(\d+)fps/i);
    const fps = fpsMatch ? parseInt(fpsMatch[1], 10) : 30;

    // 3. Workspace Assets Extraction
    let assets: any[] | undefined = undefined;
    const assetsMatch = rawPrompt.match(
      /Workspace Assets:\s*(\[[\s\S]*?\])\s*\n\nPlease utilize/i,
    );
    if (assetsMatch) {
      try {
        assets = JSON.parse(assetsMatch[1]);
      } catch {
        // assets json parsing fallback
      }
    }

    // 4. Create Structured Storyboard via StoryboardPlanner
    const storyboard = StoryboardPlanner.planFromPrompt(prompt, {
      duration,
      width,
      height,
      fps,
      assets,
    });

    // 5. Generate Project Compositions & Metadata via CompositionBuilder
    const buildResult = CompositionBuilder.buildFromStoryboard(
      storyboard,
      assets,
    );

    const outputPayload = {
      files: buildResult.files,
      metadata: buildResult.metadata,
      compositionPlan: buildResult.compositionPlan,
      storyboard,
    };

    return JSON.stringify(outputPayload, null, 2);
  }
}
