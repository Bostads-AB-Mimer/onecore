// Inline styles for rendered emails: many clients drop <style>, so every
// element carries its own. Values follow the old Infobip templates (Arial
// 14px, teal #00a4b3 band, purple #951b81 links, 500px content width).
const FONT = 'font-family:arial,helvetica,sans-serif;'

export const BRAND_COLOR = '#00a4b3'
export const CONTENT_WIDTH = 500
export const CONTENT_PADDING = 10
// Images fill the content cell; wider would make Outlook widen the layout.
export const IMAGE_WIDTH = CONTENT_WIDTH - 2 * CONTENT_PADDING

export const EMAIL_STYLES = {
  paragraph: `${FONT}font-size:14px;line-height:140%;color:#000000;margin:0 0 14px 0;`,
  // A sender's <div>: one line, no gap, as a browser shows it.
  line: `${FONT}font-size:14px;line-height:140%;color:#000000;margin:0;`,
  // Teal like the old templates; 20px bold keeps teal on white readable.
  heading: `${FONT}font-size:20px;line-height:140%;color:${BRAND_COLOR};font-weight:bold;margin:0 0 14px 0;`,
  // ### and deeper: a smaller teal title sitting close above its text.
  subheading: `${FONT}font-size:16px;line-height:140%;color:${BRAND_COLOR};font-weight:bold;margin:0 0 4px 0;`,
  link: 'color:#951b81;text-decoration:underline;',
  button: `${FONT}display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 20px;border-radius:4px;`,
  image:
    'display:block;border:none;outline:none;height:auto;max-width:100%;margin:0 0 14px 0;',
  list: `${FONT}font-size:14px;line-height:140%;color:#000000;margin:0 0 14px 0;padding-left:20px;`,
  listItem: 'margin:0 0 4px 0;',
  table: `${FONT}border-collapse:collapse;width:100%;margin:0 0 14px 0;`,
  cell: `${FONT}font-size:14px;line-height:140%;color:#000000;padding:4px 8px 4px 0;vertical-align:top;text-align:left;`,
  labelCell: `${FONT}font-size:14px;line-height:140%;color:#000000;padding:4px 8px 4px 0;vertical-align:top;text-align:left;font-weight:bold;`,
  // Layout shell. The logo has a teal tile, so the header stays white and the
  // teal band goes in the footer, as in the old templates.
  body: 'margin:0;padding:0;background-color:#ffffff;color:#000000;-webkit-text-size-adjust:100%;',
  header: 'background-color:#ffffff;padding:16px 10px;',
  content: `padding:20px ${CONTENT_PADDING}px;`,
  footer: `background-color:${BRAND_COLOR};padding:16px 10px;`,
  footerText: `${FONT}font-size:12px;line-height:140%;color:#000000;margin:0 0 6px 0;`,
  footerLink: 'color:#000000;text-decoration:underline;',
} as const
