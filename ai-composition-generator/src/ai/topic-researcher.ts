import fs from "node:fs";
import path from "node:path";

export interface ResearchedTopicInfo {
  rawPrompt: string;
  normalizedPrompt: string;
  cleanTopic: string;
  category: "awareness" | "educational_explainer" | "advertisement" | "data_visualization" | "showcase";
  isAwareness: boolean;
  isAdvertisement: boolean;
  title: string;
  summary: string;
  keyFacts: string[];
  visualThemes: string[];
  tone: string;
  suggestedArchetypes: string[];
}

export class TopicResearcher {
  /**
   * Normalizes phonetic spelling variants and common user typos.
   */
  public static normalizePrompt(raw: string): string {
    if (!raw) return "";
    return raw
      .replace(/\b(avirnas|avirness|awarnes|awarness|awerness|awarnss|awarnesse)\b/gi, "awareness")
      .replace(/\b(adverstiment|advertisment|adverstment|advertisment|comercial|commerical)\b/gi, "advertisement")
      .replace(/\b(presantation|persentation|presentaion)\b/gi, "presentation")
      .replace(/\b(explinaer|explainar|explanier)\b/gi, "explainer")
      .replace(/\b(vido|vidoe|vedio)\b/gi, "video")
      .replace(/\b(promt)\b/gi, "prompt")
      .replace(/\b(animaton|animatin|animashun)\b/gi, "animation")
      .replace(/\b(infograhic|infografic)\b/gi, "infographic")
      .trim();
  }

  /**
   * Extracts clean subject from prompt by stripping command words and technical specifications.
   */
  public static extractCleanTopic(normalized: string): string {
    let topic = normalized
      .replace(/\b(create|make|generate|produce|build|author|show|render)\s*(?:a|an)?\b/gi, "")
      .replace(/\b(awareness|advertisement|commercial|promo|explainer|presentation|video|clip|spot)\s*(?:of|about|for|on)?\b/gi, "")
      .replace(/\b(?:of|about|for|on)\b/gi, "")
      .replace(/\b\d+\s*(?:second|seconds|sec|s|minute|minutes|min|m)\b/gi, "")
      .replace(/\bwith\s*(?:some\s*)?(?:gsap|animation|animations|motion|effects|music|voiceover|presenter|avatar).*$/gi, "")
      .replace(/\band\s+(?:gsap|animation|animations|motion|effects|music|voiceover).*$/gi, "")
      .replace(/\b(?:in|at)?\s*(?:1080p|720p|4k|landscape|portrait|square|hd)\b/gi, "")
      .trim();

    topic = topic.replace(/^[\s,.-]+|[\s,.-]+$/g, "").replace(/\b(?:with|and|some|of|for|about)\s*$/i, "").trim();

    if (/\badhd\b/i.test(normalized)) {
      return "ADHD";
    }
    if (/\bautism\b/i.test(normalized)) {
      return "Autism Spectrum";
    }
    if (/\bdyslexia\b/i.test(normalized)) {
      return "Dyslexia";
    }

    return topic.length > 1 ? topic : "Innovation";
  }

  /**
   * Researches topic via Wikipedia API and domain databases to extract authoritative educational knowledge.
   */
  public static async research(rawPrompt: string): Promise<ResearchedTopicInfo> {
    const normalizedPrompt = this.normalizePrompt(rawPrompt);
    const pLower = normalizedPrompt.toLowerCase();

    const isADHD =
      /\badhd\b/i.test(pLower) ||
      pLower.includes("attention deficit") ||
      pLower.includes("hyperfocus") ||
      pLower.includes("executive dysfunction") ||
      pLower.includes("neurodiverg");

    const isExplicitAd =
      /\b(ad|advertisement|commercial|promo|product launch|shop|buy|pricing|discount)\b/i.test(pLower) &&
      !isADHD &&
      !/\b(awareness|psa|mental health|disorder|condition|syndrome)\b/i.test(pLower);

    const isAwareness =
      /\b(awareness|educat|mental health|disorder|condition|syndrome|psa|destigmat|neurodiverg)\b/i.test(pLower) ||
      isADHD;

    let category: ResearchedTopicInfo["category"] = "educational_explainer";
    if (isAwareness) category = "awareness";
    else if (isExplicitAd) category = "advertisement";
    else if (/\b(revenue|growth|chart|metric|analytics)\b/i.test(pLower)) category = "data_visualization";

    const cleanTopic = this.extractCleanTopic(normalizedPrompt);

    // Default ADHD research profile
    if (isADHD) {
      return {
        rawPrompt,
        normalizedPrompt,
        cleanTopic: "ADHD",
        category: "awareness",
        isAwareness: true,
        isAdvertisement: false,
        title: "Understanding ADHD: The Power of Neurodiversity",
        summary:
          "Attention deficit hyperactivity disorder (ADHD) is a neurodevelopmental condition affecting dopamine pathways and executive function in the brain. It is characterized not by a lack of attention, but by challenges in regulating focus, alongside remarkable strengths like hyperfocus, creativity, and lateral thinking.",
        keyFacts: [
          "Neurological Reality: ADHD is linked to dopamine dysregulation in the prefrontal cortex, not a lack of effort or discipline.",
          "The Interest-Based Nervous System: Attention fluctuates based on novelty, passion, and urgency rather than perceived task importance.",
          "Executive Dysfunction: Initiating mundane tasks, working memory, and switching contexts can cause significant cognitive friction.",
          "Time Blindness: Experiencing time in binary terms ('Now' or 'Not Now'), making standard linear scheduling difficult.",
          "The Hyperfocus Superpower: When passionate, ADHD minds enter deep flow states of extraordinary productivity and breakthroughs.",
          "Divergent Creative Thinking: High capacity for out-of-the-box innovation, lateral connections, and resilient crisis problem-solving.",
        ],
        visualThemes: [
          "Abstract neural pathways glowing with vibrant indigo, purple, and electric cyan pulses",
          "Visual depiction of high-speed racing thoughts and floating interactive cards",
          "Laser-focused neon hyperfocus ring dissolving background visual noise",
          "Sensory-friendly daily momentum rhythms, visual timers, and micro-task achievements",
          "Expanding network of colorful divergent nodes symbolizing creative lateral leaps",
          "Inspiring human empowerment lockup celebrating neurodivergent strengths",
        ],
        tone: "Empathetic, scientifically illuminating, destigmatizing, and powerfully inspiring",
        suggestedArchetypes: [
          "cinematic-hero-intro",
          "feature-split-layout",
          "hero-product-showcase",
          "metrics-counter-hud",
          "abstract-geometric-motion",
          "cinematic-climax-cta",
        ],
      };
    }

    // Live Wikipedia Research for any other topic
    let wikiSummary = "";
    let wikiTitle = cleanTopic;
    try {
      const searchTopic = encodeURIComponent(cleanTopic.replace(/\s+/g, "_"));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${searchTopic}`, {
        headers: { "User-Agent": "HyparlinkAgentEngine/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        wikiTitle = data.title || cleanTopic;
        wikiSummary = data.extract || "";
      }
    } catch {
      // Graceful offline fallback
    }

    const title = isAwareness
      ? `Understanding ${wikiTitle}: Insights & Awareness`
      : isExplicitAd
        ? `${wikiTitle}: The Next Generation Standard`
        : `${wikiTitle}: Complete Explainer`;

    const summary =
      wikiSummary ||
      `An authoritative, high-impact video exploring ${wikiTitle} through structured visual storytelling, dynamic GSAP animations, and clear narrative progression.`;

    return {
      rawPrompt,
      normalizedPrompt,
      cleanTopic: wikiTitle,
      category,
      isAwareness,
      isAdvertisement: isExplicitAd,
      title,
      summary,
      keyFacts: [
        `Core Definition: Authoritative overview of ${wikiTitle} and its primary real-world significance.`,
        `Mechanism & Context: How ${wikiTitle} functions and shapes contemporary understanding.`,
        `Key Impact: Practical applications, lived experience, and measurable real-world outcomes.`,
        `Forward Vision: Future horizons, actionable takeaways, and inspiring conclusions.`,
      ],
      visualThemes: [
        `Cinematic title hook with ambient lighting and clean typography`,
        `Detailed diagrammatic cards explaining core concepts`,
        `Dynamic data or process flows with smooth GSAP stagger tweens`,
        `Empowering conclusion with high-contrast visual CTA`,
      ],
      tone: isAwareness ? "Empathetic, educational, and inspiring" : "Polished, dynamic, and authoritative",
      suggestedArchetypes: [
        "cinematic-hero-intro",
        "feature-split-layout",
        "process-flow-nodes",
        "abstract-geometric-motion",
        "cinematic-climax-cta",
      ],
    };
  }
}
