import { useEffect, useMemo, useState } from 'react'

interface Props {
  onBack: () => void
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'quote'; text: string }

type DocKey = 'manual' | 'story'

const DOCS: Record<DocKey, { label: string; url: string; description: string; rootId: string }> = {
  manual: {
    label: 'Technical Manual',
    url: '/docs/backend.md',
    description: 'Architecture, rules, ADRs, flows, and maintenance notes.',
    rootId: 'omi-backend-architecture-manual',
  },
  story: {
    label: 'Build Story',
    url: '/docs/story.md',
    description: 'A beginner-friendly walkthrough from idea to deployment.',
    rootId: 'omi-build-story',
  },
}

const TOP_LINKS: Record<DocKey, Array<{ href: string; label: string }>> = {
  manual: [
    { href: '#the-big-ideas', label: 'Learn' },
    { href: '#api-and-realtime-contract', label: 'API' },
    { href: '#architecture-decision-records', label: 'ADRs' },
  ],
  story: [
    { href: '#the-idea', label: 'Idea' },
    { href: '#chapter-20-what-happens-when-a-player-clicks-a-card', label: 'Flow' },
    { href: '#chapter-22-preparing-for-deployment', label: 'Deploy' },
  ],
}

function docKeyFromLocation(): DocKey {
  return new URLSearchParams(window.location.search).get('tab') === 'story' ? 'story' : 'manual'
}

interface HeadingLink {
  id: string
  level: number
  text: string
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function isTableDivider(line: string) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
}

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    const fence = line.match(/^```(\w+)?/)
    if (fence) {
      const language = fence[1] ?? ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'code', language, code: codeLines.join('\n') })
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      i++
      continue
    }

    if (line.trim().startsWith('>')) {
      const quotes: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quotes.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', text: quotes.join(' ') })
      continue
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const rows = [splitTableRow(line)]
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', rows })
      continue
    }

    const unordered = line.match(/^\s*-\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      const isOrdered = !!ordered
      const items: string[] = []
      while (i < lines.length) {
        const item = lines[i].match(isOrdered ? /^\s*\d+\.\s+(.+)$/ : /^\s*-\s+(.+)$/)
        if (!item) break
        items.push(item[1])
        i++
      }
      blocks.push({ type: 'list', ordered: isOrdered, items })
      continue
    }

    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*(-|\d+\.)\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i].trim())
      i++
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }

  return blocks
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).filter(Boolean)

  return (
    <>
      {parts.map((part, index) => {
        const code = part.match(/^`([^`]+)`$/)
        if (code) return <code key={index}>{code[1]}</code>

        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) return <a key={index} href={link[2]}>{link[1]}</a>

        const strong = part.match(/^\*\*([^*]+)\*\*$/)
        if (strong) return <strong key={index}>{strong[1]}</strong>

        return <span key={index}>{part}</span>
      })}
    </>
  )
}

function MarkdownBlock({ block }: { block: Block }) {
  if (block.type === 'heading') {
    const id = slugify(block.text)
    if (block.level === 1) return <h1 id={id}><InlineText text={block.text} /></h1>
    if (block.level === 2) return <h2 id={id}><InlineText text={block.text} /></h2>
    if (block.level === 3) return <h3 id={id}><InlineText text={block.text} /></h3>
    return <h4 id={id}><InlineText text={block.text} /></h4>
  }

  if (block.type === 'paragraph') {
    return <p><InlineText text={block.text} /></p>
  }

  if (block.type === 'quote') {
    return <blockquote><InlineText text={block.text} /></blockquote>
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul'
    return (
      <ListTag>
        {block.items.map((item, index) => (
          <li key={index}><InlineText text={item} /></li>
        ))}
      </ListTag>
    )
  }

  if (block.type === 'table') {
    const [header, ...rows] = block.rows
    return (
      <div className="docs-table-wrap">
        <table>
          <thead>
            <tr>{header.map((cell, index) => <th key={index}><InlineText text={cell} /></th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <pre data-language={block.language || undefined}>
      <code>{block.code}</code>
    </pre>
  )
}

export default function DocsPage({ onBack }: Props) {
  const [activeDoc, setActiveDoc] = useState<DocKey>(() => docKeyFromLocation())
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState(DOCS[activeDoc].rootId)

  useEffect(() => {
    const handlePopState = () => setActiveDoc(docKeyFromLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let active = true
    setMarkdown('')
    setError(null)
    setActiveSectionId(DOCS[activeDoc].rootId)

    fetch(DOCS[activeDoc].url)
      .then(response => {
        if (!response.ok) throw new Error('Could not load documentation.')
        return response.text()
      })
      .then(text => { if (active) setMarkdown(text) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load documentation.') })

    return () => { active = false }
  }, [activeDoc])

  function switchDoc(next: DocKey) {
    setActiveDoc(next)
    window.history.pushState(null, '', next === 'manual' ? '/docs' : '/docs?tab=story')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const blocks = markdown ? parseMarkdown(markdown) : []
  const headings = useMemo<HeadingLink[]>(() => blocks
    .filter((block): block is Extract<Block, { type: 'heading' }> => block.type === 'heading')
    .filter(block => block.level >= 2 && block.level <= 3)
    .map(block => ({ id: slugify(block.text), level: block.level, text: block.text.replace(/`/g, '') })), [blocks])

  const sectionLinks = headings.filter(link => link.level === 2)
  const trackedSectionIds = useMemo(
    () => [DOCS[activeDoc].rootId, ...sectionLinks.map(link => link.id)],
    [activeDoc, sectionLinks],
  )

  useEffect(() => {
    if (!markdown) return

    const elements = trackedSectionIds
      .map(id => document.getElementById(id))
      .filter((element): element is HTMLElement => !!element)

    if (elements.length === 0) return

    let visibleIds = new Set<string>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleIds.add(entry.target.id)
        else visibleIds.delete(entry.target.id)
      })

      if (visibleIds.size > 0) {
        const next = elements.find(element => visibleIds.has(element.id))
        if (next) setActiveSectionId(next.id)
        return
      }

      const pastElements = elements.filter(element => element.getBoundingClientRect().top < 150)
      setActiveSectionId(pastElements.at(-1)?.id ?? DOCS[activeDoc].rootId)
    }, {
      rootMargin: '-92px 0px -68% 0px',
      threshold: [0, 1],
    })

    elements.forEach(element => observer.observe(element))

    return () => {
      visibleIds = new Set<string>()
      observer.disconnect()
    }
  }, [activeDoc, markdown, trackedSectionIds])

  return (
    <main className="docs-page min-h-dvh">
      <header className="docs-topbar">
        <button type="button" onClick={onBack} className="docs-brand">
          <span className="docs-logo">O</span>
          <span>Omi Docs</span>
        </button>
        <nav className="docs-topnav" aria-label="Documentation links">
          {TOP_LINKS[activeDoc].map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
          <a href={DOCS[activeDoc].url} target="_blank" rel="noreferrer">Markdown</a>
        </nav>
      </header>

      <section className="docs-tabs" aria-label="Documentation mode">
        {(Object.entries(DOCS) as Array<[DocKey, typeof DOCS[DocKey]]>).map(([key, doc]) => (
          <button
            key={key}
            type="button"
            className={activeDoc === key ? 'docs-tab docs-tab-active' : 'docs-tab'}
            onClick={() => switchDoc(key)}
          >
            <span>{doc.label}</span>
            <small>{doc.description}</small>
          </button>
        ))}
      </section>

      <div className="docs-shell">
        <aside className="docs-sidebar" aria-label="Docs sections">
          <p className="docs-sidebar-title">Omi Game Engine</p>
          <a
            href={`#${DOCS[activeDoc].rootId}`}
            className={activeSectionId === DOCS[activeDoc].rootId ? 'docs-sidebar-link docs-sidebar-link-active' : 'docs-sidebar-link'}
          >
            {DOCS[activeDoc].label}
          </a>
          {sectionLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={activeSectionId === link.id ? 'docs-sidebar-link docs-sidebar-link-active' : 'docs-sidebar-link'}
            >
              {link.text}
            </a>
          ))}
        </aside>

        <article className="docs-content">
          {error && <p className="docs-error">{error}</p>}
          {!error && !markdown && <p className="docs-loading">Loading docs...</p>}
          {blocks.map((block, index) => <MarkdownBlock key={index} block={block} />)}
        </article>

      </div>
    </main>
  )
}
