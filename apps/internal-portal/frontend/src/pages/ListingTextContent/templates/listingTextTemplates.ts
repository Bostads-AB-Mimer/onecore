import type { ContentBlockType } from '../components/ContentBlockEditor'

// A block as described by a template. Either `content` (prefilled, saved as-is
// unless the editor changes it) or `placeholder` (a writing hint shown in the
// empty field, never saved). Only fixed section headings use `content`;
// anything that describes the specific apartment must be a placeholder so a
// claim that does not apply cannot slip into a published listing.
export interface TemplateBlock {
  type: Exclude<ContentBlockType, 'link'>
  content?: string
  placeholder?: string
}

export interface ListingTextTemplate {
  id: string
  name: string
  description: string
  // Fixed blocks, inserted in order.
  blocks: TemplateBlock[]
  // Optional group appended after `blocks`, repeated once per room.
  roomSection?: { blocks: TemplateBlock[] }
}

const headlineBlock: TemplateBlock = {
  type: 'headline',
  placeholder: 'Här skriver du en säljande rubrik',
}

const preambleBlock: TemplateBlock = {
  type: 'preamble',
  placeholder: 'Här skriver du en kort, säljande sammanfattning om lägenheten',
}

export const listingTextTemplates: ListingTextTemplate[] = [
  {
    id: 'apartment-rooms',
    name: 'Lägenhet rum för rum',
    description:
      'Rubrik, ingress och "Om lägenheten", följt av ett avsnitt per rum (underrubrik + text).',
    blocks: [
      headlineBlock,
      preambleBlock,
      { type: 'subtitle', content: 'Om lägenheten' },
    ],
    roomSection: {
      blocks: [
        {
          type: 'bold_text',
          placeholder: 'Rum, t.ex. Hall, Sovrum eller Förråd',
        },
        {
          type: 'text',
          placeholder: 'Informativ text om rummet ovan',
        },
      ],
    },
  },
  {
    id: 'empty-headings',
    name: 'Tomma rubriker',
    description:
      'Rubrik, ingress, "Så gör du en intresseanmälan" och avsnitt för kök, badrum, ytskikt och inflytt.',
    blocks: [
      headlineBlock,
      preambleBlock,
      { type: 'subtitle', content: 'Så gör du en intresseanmälan' },
      { type: 'text', placeholder: 'T.ex. kontakta ansvarig uthyrare' },
      { type: 'subtitle', placeholder: 'Säljande rubrik om lägenheten' },
      { type: 'bold_text', placeholder: 'Köket' },
      { type: 'text', placeholder: 'Informativ text om köket' },
      { type: 'bold_text', placeholder: 'Badrummet' },
      { type: 'text', placeholder: 'Informativ text om badrummet' },
      {
        type: 'bold_text',
        placeholder:
          'Ytskikt, t.ex. Vitmålade väggar, tåligt linoleum och ekparkett',
      },
      { type: 'text', placeholder: 'Informativ text om ytskikten' },
      {
        type: 'bold_text',
        placeholder: 'Inflytt, t.ex. Möjligt med tidigare inflytt',
      },
      { type: 'text', placeholder: 'Informativ text om inflytt' },
    ],
  },
]
