import React from "react";

/**
 * Serializes structured data for inline <script> embedding.
 *
 * `<` is escaped so a `</script>` sequence inside remote content (Awesome
 * README blurbs, Hugging Face dataset descriptions) can't break out of the
 * tag and execute. `\u003c` is valid JSON and parses back to `<`.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Renders a <script type="application/ld+json"> tag with the given structured data.
 * JSON-LD is valid in both <head> and <body>.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

/**
 * Site-wide Organization schema.
 * Represents the OpenOdia project as an organization.
 */
export function siteOrganization() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "OpenOdia",
    url: "https://openodia.com",
    logo: "https://openodia.com/openodia-logo.svg",
    sameAs: [
      "https://github.com/soumendrak/openodia-hub",
      "https://www.youtube.com/@openodia",
      "https://pypi.org/project/openodia/",
    ],
    description: "Open source for the Odia language — tools, datasets, and AI resources for ଓଡ଼ିଆ.",
  };
}

/**
 * Person schema for the project maintainer.
 */
export function authorPerson() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Soumendra Kumar Sahoo",
    url: "https://www.soumendrak.com",
    sameAs: [
      "https://github.com/soumendrak",
      "https://www.linkedin.com/in/soumendrak/",
      "https://www.youtube.com/@openodia",
    ],
    jobTitle: "Staff Engineer (Observability)",
    knowsAbout: ["Odia NLP", "OpenTelemetry", "AI Observability", "LLM Platforms"],
  };
}

/**
 * WebSite schema for the site as a whole.
 */
export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OpenOdia",
    url: "https://openodia.com",
    description:
      "A home for open-source Odia language projects: the OpenOdia Python package, the @openodia YouTube channel, and the Awesome-Odia-AI directory.",
    author: { "@id": "https://www.soumendrak.com/#person" },
    inLanguage: ["en", "or"],
  };
}

/**
 * BreadcrumbList for a given page path.
 */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * FAQPage schema: question/answer pairs rendered for answer engines.
 */
export function faqPageSchema(questions: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}

/**
 * ItemList schema for collections (projects, tools).
 */
export function itemListSchema(
  items: { name: string; url: string; description: string }[],
  name: string,
  description: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: item.name,
        url: item.url,
        description: item.description,
        applicationCategory: "DeveloperApplication",
      },
    })),
  };
}

/**
 * ItemList of Events — the shape Google documents for a page that lists many
 * events rather than describing one. Entries without a resolvable start date
 * are skipped: `startDate` is required, and a guessed one is worse than none.
 */
export function eventListSchema(
  events: {
    name: string;
    url: string;
    description: string;
    startDate: string;
    endDate?: string;
    location?: string;
    organizer?: string;
  }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Odia AI community events",
    numberOfItems: events.length,
    itemListElement: events.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Event",
        name: e.name,
        url: e.url,
        description: e.description,
        startDate: e.startDate,
        ...(e.endDate ? { endDate: e.endDate } : {}),
        eventStatus: "https://schema.org/EventScheduled",
        ...(e.location
          ? {
              eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
              location: { "@type": "Place", name: e.location, address: e.location },
            }
          : {
              eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
              location: { "@type": "VirtualLocation", url: e.url },
            }),
        ...(e.organizer ? { organizer: { "@type": "Organization", name: e.organizer } } : {}),
      },
    })),
  };
}

/** ItemList of VideoObjects — the listing-page shape for video rich results. */
export function videoListSchema(
  videos: {
    id: string;
    title: string;
    published: string;
    thumbnail: string;
    channelName: string;
  }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Odia language technology tutorials",
    numberOfItems: videos.length,
    itemListElement: videos.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "VideoObject",
        name: v.title,
        description: `${v.title} — ${v.channelName}`,
        thumbnailUrl: v.thumbnail,
        uploadDate: v.published,
        contentUrl: `https://www.youtube.com/watch?v=${v.id}`,
        embedUrl: `https://www.youtube.com/embed/${v.id}`,
        publisher: { "@type": "Organization", name: v.channelName },
        inLanguage: "or",
      },
    })),
  };
}
