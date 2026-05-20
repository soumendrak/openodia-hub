import React from "react";

/**
 * Renders a <script type="application/ld+json"> tag with the given structured data.
 * JSON-LD is valid in both <head> and <body>.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
    description:
      "Open source for the Odia language — tools, datasets, and AI resources for ଓଡ଼ିଆ.",
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
export function faqPageSchema(
  questions: { question: string; answer: string }[],
) {
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
