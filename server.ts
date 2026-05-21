/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialization helper for GoogleGenAI to ensure zero boot crashes if the key is missing or is placeholder.
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
    return null; // fallback mode
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Global configuration constant for the model
const MODEL_NAME = "gemini-3.5-flash";

// Helper to check key status
app.get("/api/seo/key-status", (req: Request, res: Response) => {
  const key = process.env.GEMINI_API_KEY;
  const active = !!(key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "");
  res.json({ active });
});

/* ==========================================================================
   1. KEYWORD RESEARCH TOOL
   ========================================================================== */
app.post("/api/seo/keyword-research", async (req: Request, res: Response) => {
  const { query, region } = req.body;
  const targetRegion = region || "Pakistan";
  const ai = getAI();

  if (!ai) {
    // Premium Simulated Offline Results if no key
    const mockKeywords = [
      {
        keyword: `${query} buy online`,
        difficulty: 28,
        volume: 4800,
        intent: "Transactional",
        cpc: targetRegion === "Pakistan" ? "₨ 45.50" : targetRegion === "UAE" ? "AED 2.10" : "$1.20",
        cluster: "Direct Commerce",
        reason: `High conversion intent in ${targetRegion}. Low keyword difficulty.`
      },
      {
        keyword: `best ${query} for beginners`,
        difficulty: 19,
        volume: 3200,
        intent: "Informational",
        cpc: targetRegion === "Pakistan" ? "₨ 12.00" : targetRegion === "UAE" ? "AED 0.80" : "$0.45",
        cluster: "User Guides",
        reason: "Excellent long-tail targeting with high informational lookup rates."
      },
      {
        keyword: `affordable ${query} price ${targetRegion === 'Pakistan' ? 'karachi' : targetRegion === 'UAE' ? 'dubai' : 'near me'}`,
        difficulty: 35,
        volume: 1800,
        intent: "Commercial",
        cpc: targetRegion === "Pakistan" ? "₨ 72.00" : targetRegion === "UAE" ? "AED 3.40" : "$2.10",
        cluster: "Local Intent",
        reason: `Geographic target ideal for regional SEO boost in ${targetRegion}.`
      },
      {
        keyword: `${query} reviews comparison`,
        difficulty: 42,
        volume: 1200,
        intent: "Commercial",
        cpc: targetRegion === "Pakistan" ? "₨ 35.00" : targetRegion === "UAE" ? "AED 1.50" : "$0.95",
        cluster: "Buyer Guide",
        reason: "Captures buyers in the consideration phase before checkout."
      },
      {
        keyword: `how to optimize ${query}`,
        difficulty: 15,
        volume: 950,
        intent: "Informational",
        cpc: targetRegion === "Pakistan" ? "₨ 8.00" : targetRegion === "UAE" ? "AED 0.50" : "$0.30",
        cluster: "Tutorials",
        reason: "Extremely low difficulty. Easiest path to Page 1 ranking."
      }
    ];
    return res.json({ keywords: mockKeywords, isMock: true });
  }

  try {
    const prompt = `Perform extensive SEO keyword research for the seed keyword "${query}" tailored explicitly for target market or audience in "${targetRegion}". 
    Create exactly 5 high-converting, low-competition or localized long-tail keywords, estimated monthly search volume, keyword difficulty (0-100), search intent, CPC, topic clustering category, and a brief description/reason for each suggestion. Return structured JSON.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              difficulty: { type: Type.INTEGER, description: "SEO difficulty from 0 (easiest) to 100 (hardest)" },
              volume: { type: Type.INTEGER, description: "Monthly search volume" },
              intent: { type: Type.STRING, description: "Search intent: Informational, Commercial, Transactional, or Navigational" },
              cpc: { type: Type.STRING, description: "CPC estimation with currency symbol based on country" },
              cluster: { type: Type.STRING, description: "Category/Cluster grouping" },
              reason: { type: Type.STRING, description: "Short dynamic reason why this is recommended for local SEO" }
            },
            required: ["keyword", "difficulty", "volume", "intent", "cpc", "cluster", "reason"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ keywords: parsed, isMock: false });
  } catch (error: any) {
    console.error("Keyword Research Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate keywords via Gemini API." });
  }
});

/* ==========================================================================
   2. META TITLE & DESCRIPTION GENERATOR
   ========================================================================== */
app.post("/api/seo/meta-generator", async (req: Request, res: Response) => {
  const { keywords, type } = req.body;
  const ai = getAI();

  if (!ai) {
    const mockVariants = [
      {
        title: `Stop Wasting Time: Best ${keywords} Solutions For SaaS (2026)`,
        description: `Get dynamic custom ${keywords} optimized for high traffic. Learn how we scale startups with absolute accuracy. Check pricing deals inside!`,
        ctrScore: 94,
        focusAngle: "Value-focused, urgency-driven header."
      },
      {
        title: `Top 5 Secret ${keywords} Hacks They Don't Want You to Know`,
        description: `Struggling is over! Connect real SEO results with automated ${keywords} techniques built specifically for local and international markets.`,
        ctrScore: 89,
        focusAngle: "Curiosity-sparking title with structured benefits."
      },
      {
        title: `How to Automate ${keywords} Like a Pro: Ultimate Guide`,
        description: `Maximize web visibility effortlessly. Discover tools, schema formats, and structured strategies for ${keywords}. Get started free.`,
        ctrScore: 85,
        focusAngle: "Educational authority angle with clear CTA."
      }
    ];
    return res.json({ variants: mockVariants, isMock: true });
  }

  try {
    const prompt = `Generate exactly 3 CTR-optimized metadata variants (Meta Titles and SEO Descriptions) based on target keywords or business type "${keywords}" under the categoric style: "${type || "Standard/Professional"}". 
    Titles must stay under 60 characters and descriptions under 160 characters. Provide an estimated CTR score (1-100) and identify the specific persuasion/focus angle chosen. Return JSON output.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              ctrScore: { type: Type.INTEGER },
              focusAngle: { type: Type.STRING, description: "Persuasion framework or target audience alignment explanation" }
            },
            required: ["title", "description", "ctrScore", "focusAngle"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ variants: parsed, isMock: false });
  } catch (error: any) {
    console.error("Meta Generator Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   3. AI BLOG CONTENT OPTIMIZER & OUTLINE
   ========================================================================== */
app.post("/api/seo/blog-optimizer", async (req: Request, res: Response) => {
  const { topic, focusKeywords } = req.body;
  const ai = getAI();

  if (!ai) {
    const mockPlan = {
      title: `How to Maximize Organic SEO Traffic using ${topic || "Automation"}`,
      score: 82,
      readability: "Easy",
      nlpKeywords: ["organic traffic", "ranking signals", "local customer growth", "schema architecture", "metadata optimization"],
      competitorInsights: "Competitors are missing extensive Urdu localization guidelines. Creating localized schemas gives you an instant 40% head-start.",
      internalLinkSilo: "Internal linking is ideal when connecting this blog to the Main Service pillar page and GBP Review landing page.",
      headings: [
        { text: "Introduction: The Hidden Shift in Search Intent", type: "H2", suggestions: "Specify why traditional search tracking is changing." },
        { text: `What Makes ${topic} Crucial for Modern Rankings?`, type: "H2", suggestions: "Insert local case study statistics here." },
        { text: "Step-by-Step Blueprint for Schema Implementation", type: "H3", suggestions: "Embed our tool's custom JSON-LD generator preview." },
        { text: "Common Critical Technical Pitfalls to Avoid", type: "H2", suggestions: "Cite Core Web Vitals and Google Business Optimization." },
        { text: "Conclusion & Content Marketing Action Steps", type: "H2", suggestions: "End with a prominent CTA to download the optimization report." }
      ]
    };
    return res.json({ plan: mockPlan, isMock: true });
  }

  try {
    const prompt = `Generate a comprehensive SEO Blog Content Blueprint and Heading Outline for the topic "${topic}" with focus keywords: "${focusKeywords || "none specified"}".
    Determine a competitive title, readability grading (Easy, Medium, Difficult), NLP semantic keywords (list of 5 terms to include), brief competitor insights, internal link silo ideas, and exactly 5 optimized heading sections with advice on what details to cover in each. Return as a single JSON object.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            score: { type: Type.INTEGER, description: "Recommended overall content target optimization score from 1-100" },
            readability: { type: Type.STRING },
            nlpKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            competitorInsights: { type: Type.STRING },
            internalLinkSilo: { type: Type.STRING },
            headings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Optimized title of the heading" },
                  type: { type: Type.STRING, description: "H2, H3, or H4" },
                  suggestions: { type: Type.STRING, description: "Content tips for this specific paragraph section" }
                },
                required: ["text", "type", "suggestions"]
              }
            }
          },
          required: ["title", "score", "readability", "nlpKeywords", "competitorInsights", "internalLinkSilo", "headings"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ plan: parsed, isMock: false });
  } catch (error: any) {
    console.error("Blog Optimizer Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   4. INTERNAL LINKING TOOL
   ========================================================================== */
app.post("/api/seo/internal-links", async (req: Request, res: Response) => {
  const { siteNiche, description } = req.body;
  const ai = getAI();

  if (!ai) {
    const mockLinks = [
      {
        sourceURL: "/blog/seo-for-beginners",
        targetURL: "/services/keyword-platform",
        anchorText: "use automated keyword tool",
        relevance: "Hooks beginners looking for actionable research workflows into our paid tool page."
      },
      {
        sourceURL: "/services/local-business-booster",
        targetURL: "/blog/google-my-business-secrets",
        anchorText: "optimize Google Business Profile",
        relevance: "Establishes topical context and passes relevant authority from sales page to resource center."
      },
      {
        sourceURL: "/products/ecommerce-seo-addon",
        targetURL: "/services/keyword-platform",
        anchorText: "low-competition ecommerce research",
        relevance: "Connects localized retail buyers with our global CPC search tools."
      }
    ];
    return res.json({ links: mockLinks, isMock: true });
  }

  try {
    const prompt = `Based on a website focused on the niche: "${siteNiche}" and details: "${description}".
    Generate exactly 3 smart internal link suggestions. Each should contain a hypothetical Source URL, a Target URL, a highly relative Anchor Text to use, and a short explanation of how they boost the topical SEO cluster. Return JSON.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sourceURL: { type: Type.STRING },
              targetURL: { type: Type.STRING },
              anchorText: { type: Type.STRING },
              relevance: { type: Type.STRING }
            },
            required: ["sourceURL", "targetURL", "anchorText", "relevance"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ links: parsed, isMock: false });
  } catch (error: any) {
    console.error("Internal Links Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   5. SCHEMA GENERATOR
   ========================================================================== */
app.post("/api/seo/schema", async (req: Request, res: Response) => {
  const { schemaType, entityName, details } = req.body;
  const ai = getAI();

  if (!ai) {
    let mockSchema = "";
    if (schemaType === "faq") {
      mockSchema = `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What are the benefits of ${entityName || "our services"}?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "${details || "We offer top-ranked automation solutions to enhance traffic organically."}"
    }
  }]
}`;
    } else if (schemaType === "product") {
      mockSchema = `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${entityName || "VIP Premium SaaS Solution"}",
  "description": "${details || "Complete AI SEO subscription."}",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "49.00",
    "availability": "https://schema.org/InStock"
  }
}`;
    } else {
      mockSchema = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${entityName || "RankAura AI"}",
  "url": "https://rankaura.io",
  "logo": "https://rankaura.io/logo.png",
  "description": "${details || "Empowering small businesses worldwide."}"
}`;
    }

    return res.json({
      schema: {
        type: schemaType,
        code: mockSchema,
        description: `Statically crafted premium JSON-LD for ${schemaType}. Perfect validity score.`
      },
      isMock: true
    });
  }

  try {
    const prompt = `Generate completely valid JSON-LD schema markup for Type: "${schemaType}" named "${entityName}" using details provided: "${details}". 
    Create a robust, error-free JSON-LD inside standard script structure (generate the raw JSON text directly, DO NOT wraps in html script tags, just the pure valid JSON string). 
    Also provide a short description of where to paste it. Return JSON output carrying 'code' and 'description'.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "The pure valid JSON-LD code text string without surrounding HTML script tags" },
            description: { type: Type.STRING, description: "Where and how to apply this on your site" }
          },
          required: ["code", "description"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ schema: parsed, isMock: false });
  } catch (error: any) {
    console.error("Schema Generator Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   6. BUSINESS DESCRIPTION GENERATOR
   ========================================================================== */
app.post("/api/seo/business-description", async (req: Request, res: Response) => {
  const { businessName, industry, locationInfo, targetKeyword } = req.body;
  const ai = getAI();

  if (!ai) {
    const mockDesc = [
      {
        platform: "google_business",
        text: `Welcome to ${businessName || "RankAura Solutions"} in ${locationInfo || "Karachi & Dubai"}. We are an elite ${industry || "digital agency"} providing high-impact marketing, organic traffic boosts, and tailored ${targetKeyword || "brand growth"}. Our experts focus on maximizing localized search visibility, Google Maps rankings, and converting local clicks into reliable monthly revenues. Contact us today for premier consulting!`,
        suggestedKeywords: ["near me", "best agency", "expert local consulting"]
      },
      {
        platform: "about_us",
        text: `At ${businessName || "RankAura Solutions"}, transparency is our primary focus. Established to support businesses in ${locationInfo || "international hubs"}, we build scalable organic ${targetKeyword || "authority"} that lets you compete on the global stage. We blend technology with deep market expertise to deliver performance-driven optimization.`,
        suggestedKeywords: ["organic ranking", "trusted experts", "certified results"]
      }
    ];
    return res.json({ descriptions: mockDesc, isMock: true });
  }

  try {
    const prompt = `Generate high-ranking local-business description copy for a business named "${businessName}", in industry: "${industry}" located around Location: "${locationInfo}" hoping to optimize for core keyword: "${targetKeyword}". 
    Provide exactly two distinct descriptions, one optimized specifically for Google Business Profile (CTR oriented, highly visible, local features, up to 750 chars) and one written as premium "About Us" website content. Also include a few recommended local search keywords. Return JSON array.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING, description: "google_business or about_us" },
              text: { type: Type.STRING, description: "The generated copy text" },
              suggestedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["platform", "text", "suggestedKeywords"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ descriptions: parsed, isMock: false });
  } catch (error: any) {
    console.error("Business Description Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   7. IMAGE SEO OPTIMIZATION
   ========================================================================== */
app.post("/api/seo/image-seo", async (req: Request, res: Response) => {
  const { filenames } = req.body; // e.g. ["IMG_39402_edited.png", "raw-header-new.png"]
  const fileArray = filenames || ["unnamed_shot.png"];
  const ai = getAI();

  if (!ai) {
    const mockImageSEO = fileArray.map((fn: string) => ({
      originalFilename: fn,
      recommendedFilename: fn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-png$|-jpg$/, "") + "-seo.webp",
      altText: `Premium customized professional representation showcasing optimized features related to our site structure.`,
      webpTip: "Convert to WebP using 82% quality to achieve standard Google Lighthouse performance points easily.",
      compressionEstimation: "Save up to 74% bytes (estimated reduction from 2.5MB to 650KB) with zero perceptual quality loss."
    }));
    return res.json({ recommendations: mockImageSEO, isMock: true });
  }

  try {
    const prompt = `Perform SEO analysis and recommend optimized filenames and Alt Attributes for the following raw filenames: ${JSON.stringify(fileArray)}. 
    For each image, provide the recommended web-friendly .webp filename (no spaces, hyphenated structure, descriptive keywords), descriptive Alt Text, an image-specific WebP suggestion, and compression estimation advice. Return JSON list.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalFilename: { type: Type.STRING },
              recommendedFilename: { type: Type.STRING },
              altText: { type: Type.STRING },
              webpTip: { type: Type.STRING },
              compressionEstimation: { type: Type.STRING }
            },
            required: ["originalFilename", "recommendedFilename", "altText", "webpTip", "compressionEstimation"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ recommendations: parsed, isMock: false });
  } catch (error: any) {
    console.error("Image SEO Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   8. COMPREHENSIVE SEO AUDIT SCANNER (REAL CHAT GROUNDING SIMULATOR)
   ========================================================================== */
app.post("/api/seo/audit-url", async (req: Request, res: Response) => {
  const { websiteUrl } = req.body;
  const ai = getAI();

  if (!ai) {
    const mockAudit = {
      score: 74,
      grade: "C",
      items: [
        { category: "seo", status: "warning", title: "Missing H1 Heading Tag", description: "No clear <h1> text is detected on the homepage layout.", recommendation: "Wrap your primary value proposition in a single <h1> tag containing target keywords." },
        { category: "mobile", status: "good", title: "Excellent Mobile Viewport Configured", description: "Standard viewport width has been applied.", recommendation: "No immediate changes required. Viewport parameters verified perfectly." },
        { category: "performance", status: "error", title: "Uncompressed Heavy Assets", description: "3 high-resolution homepage media files exceed 1.5MB each.", recommendation: "Convert images to .webp structure and reduce resolution." },
        { category: "security", status: "good", title: "SSL / HTTPS Activated", description: "Safe SSL transport verified successfully.", recommendation: "Enforce HTTPS rewrite redirects uniformly inside server.ts config." },
        { category: "seo", status: "warning", title: "Robots.txt & Sitemap Out of Sync", description: "Your robots.txt does not index the main XML location.", recommendation: "Add 'Sitemap: https://yoursite.com/sitemap.xml' to the bottom of robots.txt." }
      ]
    };
    return res.json({ audit: mockAudit, isMock: true });
  }

  try {
    const prompt = `Simulate a full-scale Technical & On-Page SEO audit for the website URL: "${websiteUrl}". 
    Create a highly realistic evaluation list containing exactly 5 critical items across different categories (seo, performance, mobile, security). Give each item a status (good, warning, error), title, dynamic description, and actionable technical recommendation. Return an overall score (0 to 100) and letter grade (A, B, C, D, F). Return JSON.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            grade: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, description: "seo, mobile, performance, or security" },
                  status: { type: Type.STRING, description: "good, warning, or error" },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  recommendation: { type: Type.STRING }
                },
                required: ["category", "status", "title", "description", "recommendation"]
              }
            }
          },
          required: ["score", "grade", "items"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ audit: parsed, isMock: false });
  } catch (error: any) {
    console.error("Audit URL Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   9. SEO CHATBOT ASSISTANT
   ========================================================================== */
app.post("/api/seo/chat", async (req: Request, res: Response) => {
  const { messages } = req.body;
  const ai = getAI();

  if (!ai) {
    const lastUserMsg = messages[messages.length - 1]?.text || "Hello";
    let mockResponse = `As RankAura AI, I'm happy to help you optimize. To rank for **"${lastUserMsg}"**, make sure to:
    1. Structure your content with focused heading clusters (H2 + H3).
    2. Add FAQ schema directly explaining key commercial terms.
    3. Ensure load speed satisfies standard Core Web Vitals.
    
    *Note: Please check Settings > Secrets to integrate your Gemini key for fully dynamic responses.*`;
    return res.json({ text: mockResponse, isMock: true });
  }

  try {
    // Reconstruct conversation
    const formattedHistory = messages.map((m: any) => ({
      role: m.role || "user",
      parts: [{ text: m.text }]
    }));

    // We can also inject system instructions
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: [{ text: `You are RankAura AI, a world-class premium SEO expert and SaaS advisor specializing in small businesses, blogging, Shopify eCommerce, digital agencies, and local SEO in Pakistan, UAE, Canada, and the USA. Answer inquiries professionally, actionably, listing schema setups, keyword recommendations, local tips, and CTR advice.` }]
        },
        ...formattedHistory
      ]
    });

    return res.json({ text: response.text || "No reply generated. Let's try rephrasing.", isMock: false });
  } catch (error: any) {
    console.error("SEO Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   10. ROBOTS.TXT AND SITEMAP GENERATOR (TECHNICAL TOOLKIT)
   ========================================================================== */
app.post("/api/seo/robots-generator", async (req: Request, res: Response) => {
  const { domain, crawlDelay, allowAdmin } = req.body;
  const siteDomain = domain || "example.com";
  const ai = getAI();

  if (!ai) {
    const robotsText = `User-agent: *
Disallow: ${allowAdmin ? "" : "/admin/"}
Disallow: /checkout/
Disallow: /api/
Allow: /

Sitemap: https://${siteDomain}/sitemap.xml`;

    const sitemapText = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${siteDomain}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://${siteDomain}/services</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

    const checklist = [
      { title: "Primary Sitemap Path Declared", passed: true, recommendation: "Sitemap correctly listed at the base of Robots.txt." },
      { title: "Safe Crawl Delay Enabled", passed: true, recommendation: `Crawl delay adjusted perfectly for ${siteDomain} server bandwidth.` },
      { title: "Private Paths Disallowed", passed: true, recommendation: "Disallow tags configured properly." }
    ];

    return res.json({ robotsTxt: robotsText, sitemapXml: sitemapText, checklist, isMock: true });
  }

  try {
    const prompt = `Generate an absolutely optimized Robots.txt file and companion XML sitemap for the domain "${siteDomain}" with Crawl Delay: "${crawlDelay || "none"}" and Disallow Private Admin: "${allowAdmin ? "no" : "yes"}".
    Provide both blocks along with a simple 3-item compliance checklist. Return structured JSON.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            robotsTxt: { type: Type.STRING },
            sitemapXml: { type: Type.STRING },
            checklist: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  passed: { type: Type.BOOLEAN },
                  recommendation: { type: Type.STRING }
                },
                required: ["title", "passed", "recommendation"]
              }
            }
          },
          required: ["robotsTxt", "sitemapXml", "checklist"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ ...parsed, isMock: false });
  } catch (error: any) {
    console.error("Robots Error:", error);
    res.status(500).json({ error: error.message });
  }
});


// Serve static/vite assets as required by full-stack React framework setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Dev Mode - Mount Vite Middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode - Serve static files direct from dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RankAura AI Full-Stack Server successfully mounted on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start RankAura server:", err);
});
