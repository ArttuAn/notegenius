export const CHAT_SYSTEM = `You are NoteGenius, an expert research assistant. Answer questions based ONLY on the provided sources below.

Rules:
- Cite sources using [N] notation where N is the source number shown in the context
- If the answer is not in the sources, say so honestly
- Be thorough and accurate
- Use markdown formatting for clarity
- When multiple sources support a point, cite all of them

Sources are provided in <sources> tags. Each source shows its index number, title, and chunk position.`;

export const GENERATE_PROMPTS: Record<string, string> = {
  summary: `Analyze the provided source documents and write a comprehensive executive summary.
Structure it with:
1. Overview (2-3 sentences)
2. Key Findings (3-5 bullet points)
3. Main Themes (2-3 paragraphs)
4. Conclusion

Use markdown formatting.`,

  faq: `Generate a comprehensive FAQ (Frequently Asked Questions) based on the source documents.
Create 8-12 questions that a reader would likely ask, with detailed answers.
Format as:
## Q: [Question]
**A:** [Detailed answer with evidence from sources]

Cover different aspects and difficulty levels.`,

  study_guide: `Create a comprehensive study guide from the source documents.
Include:
## Key Concepts
(Define and explain important terms and ideas)

## Main Topics
(Organized sections covering major themes)

## Practice Questions
(5-8 questions to test understanding, with answers)

## Summary
(Brief recap of the most important points)`,

  timeline: `Extract all dates, events, and time-based information from the sources.
Create a chronological timeline in markdown format:

## Timeline of Events

**[Date/Period]** — [Event description]

Sort from earliest to most recent. Include approximate dates when exact ones aren't given.
If no timeline information exists, create a conceptual progression of ideas instead.`,

  key_topics: `Identify and analyze the 8-10 most important topics from the source documents.
For each topic:

## [Topic Name]
**Summary:** [2-3 sentence explanation]
**Key Points:** [Bullet list of important details]
**Significance:** [Why this matters]

Sort by importance.`,

  concept_map: `Create a hierarchical concept map from the source documents in markdown format.
Show relationships between ideas:

# [Central Topic]
## [Main Category 1]
### [Subconcept A]
- Detail
- Detail
### [Subconcept B]
## [Main Category 2]
...

Use → to show relationships between concepts where helpful.`,

  audio_script: `Create an engaging podcast-style conversation script based on the source documents.
Two hosts discuss the material in a natural, conversational way:

**HOST A (Alex):** [Introduction and overview]
**HOST B (Sam):** [Reaction and first question]
**HOST A:** [Explanation]
...

Make it engaging, informative, and accessible. Include natural transitions, analogies, and "aha moment" exchanges. Aim for a 10-15 minute read (about 1500-2000 words).`,
};
