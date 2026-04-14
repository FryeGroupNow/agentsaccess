'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  PRODUCT_CATEGORIES, USD_PER_CREDIT, PRODUCT_TYPE_LABELS,
  type ProductType, type PricingType, type ProductSections, type Product,
} from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  X, ShoppingBag, Upload, FileText, Info, Image as ImageIcon, Eye,
  Sparkles, Plus, Trash2, Briefcase, Package, Code, Database, Palette, Wrench,
} from 'lucide-react'

const STARTER_AA_INFO =
  'Starter AA credits cannot be cashed out directly. The founder plans to buy them back at minimum 1.25:1, aiming for 2:1 based on ecosystem activity. Accepting Starter AA increases your potential buyer pool.'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

interface CreateListingModalProps {
  onClose: () => void
  onCreated: (product: Product) => void
}

const PRODUCT_TYPE_ORDER: ProductType[] = [
  'digital_product', 'service', 'template', 'tool', 'api', 'dataset', 'digital_art',
]

const PRODUCT_TYPE_ICONS: Record<ProductType, React.ComponentType<{ className?: string }>> = {
  digital_product: Package,
  service:         Briefcase,
  template:        FileText,
  tool:            Wrench,
  api:             Code,
  dataset:         Database,
  digital_art:     Palette,
}

const SECTION_PLACEHOLDERS: Record<ProductType, ProductSections> = {
  digital_product: {
    whats_included: '• The main product file(s)\n• Any supporting docs or guides\n• Free updates for X months',
    who_its_for:    'This is for developers, marketers, or creators who need …',
    how_it_works:   '1. Purchase with AA Credits\n2. Download immediately after checkout\n3. Follow the included setup guide',
    requirements:   'No special requirements — works on any modern system.',
    faq:            'Q: Can I get a refund?\nA: Yes, within 14 days if the file doesn\'t work as described.\n\nQ: Commercial use allowed?\nA: Yes.',
  },
  service: {
    whats_included: '• Discovery call to understand your goals\n• Deliverables: X, Y, Z\n• One round of revisions included',
    who_its_for:    'Businesses or creators who need … done by a reliable AI agent.',
    how_it_works:   '1. Describe your job in the brief\n2. I accept or propose adjustments\n3. I deliver the work within the agreed timeline\n4. You confirm delivery and credits are released',
    requirements:   'Please provide: access to … , a clear spec, any brand/style guides.',
    faq:            'Q: How fast is turnaround?\nA: Typically 24–72 hours.\n\nQ: Revisions?\nA: One round included; additional revisions can be quoted.',
  },
  template: {
    whats_included: '• Editable template files\n• Instructions\n• Example output',
    who_its_for:    'Anyone who needs a starting point for …',
    how_it_works:   '1. Buy and download\n2. Customize to fit your needs\n3. Use immediately',
    requirements:   'Software: e.g. Figma, Notion, Excel. Compatibility listed below.',
    faq:            'Q: Can I resell modified versions?\nA: For personal use and client work, yes. Not for re-sale as a template.',
  },
  tool: {
    whats_included: '• Binary / installer / web app access\n• Documentation\n• Setup support',
    who_its_for:    'Users who want to automate …',
    how_it_works:   '1. Purchase to get a license key\n2. Download and install\n3. Enter key on first launch',
    requirements:   'System requirements and dependencies listed here.',
    faq:            'Q: License type?\nA: One seat per purchase. Volume discounts available.',
  },
  api: {
    whats_included: '• API key\n• Documentation link\n• Example requests',
    who_its_for:    'Developers integrating … into their products.',
    how_it_works:   '1. Purchase to generate an API key\n2. Read the docs\n3. Start calling the endpoints',
    requirements:   'Basic HTTP client. Rate limits apply; details in docs.',
    faq:            'Q: What\'s the rate limit?\nA: X requests per minute on the standard tier.',
  },
  dataset: {
    whats_included: '• Full dataset in CSV / JSON / Parquet\n• Schema documentation\n• Sample queries',
    who_its_for:    'Data scientists, ML engineers, and researchers working on …',
    how_it_works:   '1. Purchase and download\n2. Load into your tool of choice\n3. Reference the schema doc',
    requirements:   'Roughly X GB of disk space. Compatible with pandas / polars / duckdb.',
    faq:            'Q: How often is it updated?\nA: Monthly refreshes included in the purchase.',
  },
  digital_art: {
    whats_included: '• The original artwork file (high-res)\n• Proof of ownership on AgentsAccess\n• Non-exclusive display rights',
    who_its_for:    'Collectors who want to own a unique piece.',
    how_it_works:   '1. One buyer purchases and becomes the sole owner\n2. Listing is retired after sale\n3. Ownership is recorded on your profile',
    requirements:   'Nothing — digital ownership transfers automatically.',
    faq:            'Q: Can I resell?\nA: Not through this listing — contact the artist.',
  },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CreateListingModal({ onClose, onCreated }: CreateListingModalProps) {
  // Core fields
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [productType, setProductType] = useState<ProductType>('digital_product')
  const [pricingType, setPricingType] = useState<PricingType>('one_time')
  const [priceCredits, setPriceCredits] = useState('')
  const [subscriptionDays, setSubscriptionDays] = useState('30')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')

  // Sections
  const [sections, setSections] = useState<ProductSections>({})
  const [sectionsInitialized, setSectionsInitialized] = useState<ProductType | null>(null)

  // Media
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [newImageUrl, setNewImageUrl] = useState('')

  // File
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Settings
  const [acceptStarterAA, setAcceptStarterAA] = useState(true)
  const [showStarterInfo, setShowStarterInfo] = useState(false)

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const priceNum = parseInt(priceCredits) || 0
  const usdPreview = priceNum > 0 ? `$${(priceNum * USD_PER_CREDIT).toFixed(2)}` : null
  const isService = productType === 'service'
  const isDigitalArt = productType === 'digital_art'

  function pickType(type: ProductType) {
    setProductType(type)
    if (type === 'service') setPricingType('one_time')
    // Fill in section placeholders on first pick of a type
    if (sectionsInitialized !== type) {
      const allEmpty = Object.values(sections).every((v) => !v || v.trim() === '')
      if (allEmpty) {
        setSections(SECTION_PLACEHOLDERS[type])
      }
      setSectionsInitialized(type)
    }
  }

  function updateSection<K extends keyof ProductSections>(key: K, value: string) {
    setSections((prev) => ({ ...prev, [key]: value }))
  }

  function addImage() {
    const url = newImageUrl.trim()
    if (!url) return
    setImages((prev) => [...prev, url])
    setNewImageUrl('')
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_FILE_BYTES) {
      setError('File must be under 50 MB')
      e.target.value = ''
      return
    }
    setFile(f)
    setError(null)
  }

  async function uploadFile(userId: string): Promise<{ url: string; name: string; size: number } | null> {
    if (!file) return null
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-files')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
    const { data } = supabase.storage.from('product-files').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name, size: file.size }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !category) return
    if (pricingType !== 'contact' && !priceNum) return
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); return }

      let fileData: { url: string; name: string; size: number } | null = null
      if (file) fileData = await uploadFile(user.id)

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          tagline: tagline.trim() || null,
          description: description.trim(),
          price_credits: pricingType === 'contact' ? 0 : priceNum,
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          is_digital_art: isDigitalArt,
          accept_starter_aa: acceptStarterAA,
          file_url: fileData?.url ?? null,
          file_name: fileData?.name ?? null,
          file_size_bytes: fileData?.size ?? null,
          cover_image_url: coverImageUrl.trim() || null,
          images,
          sections,
          product_type: productType,
          pricing_type: pricingType,
          subscription_period_days: pricingType === 'subscription' ? parseInt(subscriptionDays) || 30 : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create listing')
        return
      }
      onCreated(data.data ?? data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const SECTION_FIELDS: { key: keyof ProductSections; label: string; hint: string }[] = [
    { key: 'whats_included', label: "What's included",  hint: 'List every deliverable so buyers know exactly what they get.' },
    { key: 'who_its_for',    label: 'Who this is for',  hint: 'Describe the ideal buyer.' },
    { key: 'how_it_works',   label: 'How it works',     hint: 'Walk them through the experience step by step.' },
    { key: 'requirements',   label: 'Requirements',     hint: 'Any prerequisites, dependencies, or setup steps.' },
    { key: 'faq',            label: 'FAQ',              hint: 'Answer the questions buyers always ask.' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Create Listing</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(true)}
              disabled={!title.trim()}
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Preview
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Product type picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Product type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRODUCT_TYPE_ORDER.map((t) => {
                const Icon = PRODUCT_TYPE_ICONS[t]
                const active = productType === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickType(t)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      active ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className={`text-[11px] font-medium text-center leading-tight ${active ? 'text-indigo-700' : 'text-gray-600'}`}>
                      {PRODUCT_TYPE_LABELS[t]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title + tagline */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Title</label>
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={isService ? 'e.g. Write a 1,500 word SEO blog post' : 'e.g. Premium SaaS landing page template'}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Tagline <span className="text-gray-400 font-normal">— one-liner on the card</span>
              </label>
              <input
                type="text"
                maxLength={140}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={isService ? 'Fast, well-researched posts that rank' : 'Launch your startup in under an hour'}
              />
            </div>
          </div>

          {/* Short description */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Short description <span className="text-gray-400 font-normal">— appears near the top of the detail page</span>
            </label>
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Describe what the buyer gets in a sentence or two."
            />
          </div>

          {/* Sectioned detail fields */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-indigo-900">Rich listing sections</h3>
              <span className="text-[11px] text-indigo-500">(auto-filled based on product type)</span>
            </div>
            {SECTION_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
                <textarea
                  rows={3}
                  value={sections[key] ?? ''}
                  onChange={(e) => updateSection(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                  placeholder={hint}
                />
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Pricing</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { id: 'one_time' as const,      label: 'One-time' },
                { id: 'subscription' as const,  label: 'Subscription' },
                { id: 'contact' as const,       label: 'Contact for pricing' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPricingType(id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                    pricingType === id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-indigo-200 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {pricingType !== 'contact' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {pricingType === 'subscription' ? 'Price per period (AA)' : 'Price (AA Credits)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      value={priceCredits}
                      onChange={(e) => setPriceCredits(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                      placeholder="50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">AA</span>
                  </div>
                  {usdPreview && <p className="text-xs text-gray-400 mt-1">≈ {usdPreview}</p>}
                </div>

                {pricingType === 'subscription' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Period (days)</label>
                    <input
                      type="number"
                      min={1}
                      value={subscriptionDays}
                      onChange={(e) => setSubscriptionDays(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="30"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category + tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Category</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Select…</option>
                {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="seo, content, writing"
              />
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Cover image URL <span className="text-gray-400 font-normal">— shown on cards and the detail hero</span>
            </label>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://…"
              />
            </div>
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="Cover preview" className="mt-2 rounded-lg max-h-40 object-cover w-full border border-gray-100" />
            )}
          </div>

          {/* Gallery images */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Gallery images <span className="text-gray-400 font-normal">— screenshots, previews, demos</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://… then click Add"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addImage} disabled={!newImageUrl.trim()}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add
              </Button>
            </div>
            {images.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {images.map((url, i) => (
                  <div key={i} className="relative group aspect-video bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 rounded bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product file (for deliverable-style listings) */}
          {!isService && pricingType !== 'contact' && (
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Product file <span className="text-gray-400 font-normal">(delivered on purchase, max 50 MB)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.zip,.png,.jpg,.jpeg,.gif,.mp4,.mp3,.svg,.ai,.psd,.sketch,.fig,.csv,.json,.txt,.docx,.xlsx"
              />
              {file ? (
                <div className="flex items-center gap-3 border border-indigo-200 bg-indigo-50 rounded-lg px-3 py-2.5">
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-indigo-800 truncate">{file.name}</p>
                    <p className="text-xs text-indigo-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-indigo-400 hover:text-indigo-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Click to attach a file
                </button>
              )}
            </div>
          )}

          {/* Accept Starter AA toggle */}
          <div>
            <div
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                acceptStarterAA ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setAcceptStarterAA((v) => !v)}
            >
              <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                acceptStarterAA ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
              }`}>
                {acceptStarterAA && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z"/></svg>}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-800">Accept Starter AA</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowStarterInfo((v) => !v) }}
                    className="text-gray-400 hover:text-indigo-600"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {acceptStarterAA
                    ? 'Buyers can pay with any AA credits including Starter AA.'
                    : 'Buyers must use Redeemable AA only.'}
                </p>
              </div>
            </div>
            {showStarterInfo && (
              <div className="mt-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-800 leading-relaxed">
                {STARTER_AA_INFO}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !title.trim() || !description.trim() || !category || (pricingType !== 'contact' && !priceNum)}
            >
              {loading ? (file ? 'Uploading…' : 'Creating…') : 'Publish listing'}
            </Button>
          </div>
        </form>

        {/* Preview modal */}
        {showPreview && (
          <PreviewOverlay
            title={title}
            tagline={tagline}
            description={description}
            coverImageUrl={coverImageUrl}
            images={images}
            sections={sections}
            priceCredits={priceNum}
            pricingType={pricingType}
            productType={productType}
            category={category}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </div>
  )
}

function PreviewOverlay(props: {
  title: string
  tagline: string
  description: string
  coverImageUrl: string
  images: string[]
  sections: ProductSections
  priceCredits: number
  pricingType: PricingType
  productType: ProductType
  category: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-indigo-500" /> Preview (not yet published)
          </span>
          <button onClick={props.onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          {props.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.coverImageUrl} alt="Cover" className="w-full h-64 object-cover rounded-xl mb-5 border border-gray-100" />
          )}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {PRODUCT_TYPE_LABELS[props.productType]}
            </span>
            {props.category && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {props.category}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-1">{props.title || 'Your title here'}</h1>
          {props.tagline && <p className="text-base text-gray-500 mb-4">{props.tagline}</p>}
          <div className="text-sm font-bold text-indigo-600 mb-5">
            {props.pricingType === 'contact'
              ? 'Contact for pricing'
              : `${props.priceCredits.toLocaleString()} AA${props.pricingType === 'subscription' ? ' / period' : ''}`}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">{props.description}</p>

          {props.images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {props.images.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-full aspect-video object-cover rounded-lg border border-gray-100" />
              ))}
            </div>
          )}

          <div className="space-y-5">
            {Object.entries(props.sections).filter(([, v]) => v && v.trim()).map(([k, v]) => (
              <div key={k}>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5 capitalize">
                  {k.replaceAll('_', ' ')}
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
