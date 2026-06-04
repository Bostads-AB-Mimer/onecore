import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Maximize, X, ZoomIn, ZoomOut } from 'lucide-react'
import svgPanZoom from 'svg-pan-zoom'

type PanZoomInstance = ReturnType<typeof svgPanZoom>
type Adjacency = Map<string, Set<string>>

let mermaidInitialized = false

interface MermaidDiagramProps {
  chart: string
  /**
   * Optional per-node highlight overrides. When the user clicks a node
   * whose id is a key in this map, the listed node ids (instead of the
   * 1-hop neighbors) define the highlighted subgraph. Used to express
   * indirect relationships the diagram itself can't express — e.g.
   * a frontend reaching specific services through a gateway.
   */
  focusOverrides?: Record<string, string[]>
}

const NODE_ID_RE = /^flowchart-(.+)-\d+$/

function extractNodeId(element: Element): string | null {
  const match = element.id.match(NODE_ID_RE)
  return match ? match[1] : null
}

function extractEdgeEndpoints(
  element: Element
): { source: string; target: string } | null {
  let source: string | null = null
  let target: string | null = null
  element.classList.forEach((cls) => {
    if (cls.startsWith('LS-')) source = cls.slice(3)
    else if (cls.startsWith('LE-')) target = cls.slice(3)
  })
  if (source && target) return { source, target }
  return null
}

function buildAdjacency(svg: SVGSVGElement): Adjacency {
  const adj: Adjacency = new Map()
  const edges = svg.querySelectorAll('.flowchart-link, .edgePath')
  edges.forEach((edge) => {
    const ends = extractEdgeEndpoints(edge)
    if (!ends) return
    if (!adj.has(ends.source)) adj.set(ends.source, new Set())
    if (!adj.has(ends.target)) adj.set(ends.target, new Set())
    adj.get(ends.source)!.add(ends.target)
    adj.get(ends.target)!.add(ends.source)
  })
  return adj
}

function applyFocus(
  svg: SVGSVGElement,
  focused: string | null,
  adj: Adjacency,
  overrides: Record<string, string[]> | undefined
) {
  const nodes = svg.querySelectorAll('g.node')
  const edges = svg.querySelectorAll('.flowchart-link, .edgePath')
  const edgeLabels = svg.querySelectorAll('.edgeLabel')

  if (!focused) {
    nodes.forEach((n) => n.classList.remove('mermaid-dimmed'))
    edges.forEach((e) => e.classList.remove('mermaid-dimmed'))
    edgeLabels.forEach((l) => l.classList.remove('mermaid-dimmed'))
    return
  }

  const keepNodes = new Set<string>([focused])
  const override = overrides?.[focused]
  if (override) {
    override.forEach((n) => keepNodes.add(n))
  } else {
    adj.get(focused)?.forEach((n) => keepNodes.add(n))
  }

  nodes.forEach((node) => {
    const id = extractNodeId(node)
    if (id && keepNodes.has(id)) {
      node.classList.remove('mermaid-dimmed')
    } else {
      node.classList.add('mermaid-dimmed')
    }
  })

  // An edge is part of the highlighted subgraph when both endpoints are
  // in the keep set. For 1-hop neighbors this matches "edge touches the
  // focused node"; for overrides it shows the connecting path
  // (e.g. frontend → core → service).
  edges.forEach((edge) => {
    const ends = extractEdgeEndpoints(edge)
    const involved =
      ends && keepNodes.has(ends.source) && keepNodes.has(ends.target)
    if (involved) {
      edge.classList.remove('mermaid-dimmed')
    } else {
      edge.classList.add('mermaid-dimmed')
    }
  })

  // Edge labels in Mermaid don't carry LS-/LE- classes reliably,
  // so we dim all of them when a focus is active — the highlighted
  // edges themselves stay visible.
  edgeLabels.forEach((label) => label.classList.add('mermaid-dimmed'))
}

export function MermaidDiagram({ chart, focusOverrides }: MermaidDiagramProps) {
  const reactId = useId()
  const renderId = `mermaid-${reactId.replace(/:/g, '')}`
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panZoomRef = useRef<PanZoomInstance | null>(null)
  const adjacencyRef = useRef<Adjacency>(new Map())
  const [focusedNode, setFocusedNode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleNodeClick = useCallback((id: string) => {
    setFocusedNode((current) => (current === id ? null : id))
  }, [])

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        const { default: mermaid } = await import('mermaid')

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
          })
          mermaidInitialized = true
        }

        const { svg } = await mermaid.render(renderId, chart)

        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = svg

        const svgEl = containerRef.current.querySelector<SVGSVGElement>('svg')
        if (!svgEl) return

        svgEl.removeAttribute('style')
        svgEl.setAttribute('width', '100%')
        svgEl.setAttribute('height', '100%')

        adjacencyRef.current = buildAdjacency(svgEl)

        svgEl.querySelectorAll<SVGGElement>('g.node').forEach((node) => {
          const id = extractNodeId(node)
          if (!id) return
          node.style.cursor = 'pointer'
          node.addEventListener('click', (e) => {
            e.stopPropagation()
            handleNodeClick(id)
          })
        })

        if (panZoomRef.current) {
          panZoomRef.current.destroy()
          panZoomRef.current = null
        }

        panZoomRef.current = svgPanZoom(svgEl, {
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.3,
          maxZoom: 10,
          zoomScaleSensitivity: 0.3,
        })

        setError(null)
        setFocusedNode(null)
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
        }
      }
    }

    render()

    return () => {
      cancelled = true
      if (panZoomRef.current) {
        panZoomRef.current.destroy()
        panZoomRef.current = null
      }
    }
  }, [chart, renderId, handleNodeClick])

  useEffect(() => {
    const svgEl = containerRef.current?.querySelector<SVGSVGElement>('svg')
    if (!svgEl) return
    applyFocus(svgEl, focusedNode, adjacencyRef.current, focusOverrides)
  }, [focusedNode, focusOverrides])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      panZoomRef.current?.resize()
      panZoomRef.current?.fit()
      panZoomRef.current?.center()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const handleZoomIn = () => panZoomRef.current?.zoomBy(1.25)
  const handleZoomOut = () => panZoomRef.current?.zoomBy(0.8)
  const handleReset = () => {
    if (!panZoomRef.current) return
    panZoomRef.current.resetZoom()
    panZoomRef.current.center()
    panZoomRef.current.fit()
  }
  const handleClearFocus = () => setFocusedNode(null)

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive mb-2">
          Kunde inte rendera diagrammet: {error}
        </p>
        <pre className="text-xs overflow-x-auto bg-muted p-3 rounded">
          {chart}
        </pre>
      </div>
    )
  }

  return (
    <div className="mermaid-diagram-container relative rounded-md border border-border bg-background">
      <style>{`
        .mermaid-diagram-container g.node,
        .mermaid-diagram-container .flowchart-link,
        .mermaid-diagram-container .edgePath,
        .mermaid-diagram-container .edgeLabel {
          transition: opacity 0.2s ease, filter 0.2s ease;
        }
        .mermaid-diagram-container .mermaid-dimmed {
          opacity: 0.12;
          filter: grayscale(1);
        }
      `}</style>

      {focusedNode && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs shadow-sm">
          <span className="text-muted-foreground">Fokus:</span>
          <span className="font-mono font-medium">{focusedNode}</span>
          <button
            type="button"
            onClick={handleClearFocus}
            className="ml-1 rounded p-0.5 hover:bg-accent"
            aria-label="Rensa fokus"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          type="button"
          onClick={handleZoomIn}
          className="rounded border border-border bg-background p-1.5 hover:bg-accent"
          aria-label="Zooma in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="rounded border border-border bg-background p-1.5 hover:bg-accent"
          aria-label="Zooma ut"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded border border-border bg-background p-1.5 hover:bg-accent"
          aria-label="Återställ vy"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      <div ref={containerRef} className="h-[600px] w-full" />
    </div>
  )
}
