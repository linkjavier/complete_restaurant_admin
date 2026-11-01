"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

import { getCategories, getLocations, Category, Location, API_URL, getAuthHeaders, createCategory } from "@/lib/api"

interface ExtractedProduct {
    name: string
    description: string
    price: number
    categoryName?: string
    categoryId?: string // For manual override or auto-mapping
}

interface ImportProductsDialogProps {
    isOpen: boolean
    onClose: () => void
    onProductsImported: (products: any[]) => void
    categories: Category[]
    locations: Location[]
    showLocationSelector?: boolean
    defaultLocationId?: string
    onCategoryCreated?: () => void
}

export function ImportProductsDialog({
    isOpen,
    onClose,
    onProductsImported,
    categories,
    locations,
    showLocationSelector = true,
    defaultLocationId = "",
    onCategoryCreated,
}: ImportProductsDialogProps) {
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([])
    const [detectedCategories, setDetectedCategories] = useState<string[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
    const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultLocationId)
    const [creatingCategories, setCreatingCategories] = useState(false)
    const [createdCategoriesMap, setCreatedCategoriesMap] = useState<Record<string, string>>({})
    const [processingStep, setProcessingStep] = useState<number>(0)

    const steps = [
        { label: "Leyendo documento...", icon: <FileText className="h-4 w-4" /> },
        { label: "Analizando estructura...", icon: <Upload className="h-4 w-4" /> },
        { label: "IA Identificando categorías...", icon: <AlertCircle className="h-4 w-4" /> },
        { label: "Extrayendo productos...", icon: <Check className="h-4 w-4" /> },
    ]

    const { toast } = useToast()

    useEffect(() => {
        if (isOpen) {
            setSelectedLocationId(defaultLocationId)
        }
    }, [defaultLocationId, isOpen])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setLoading(true)
        setProcessingStep(0)

        const formData = new FormData()
        formData.append('file', file)

        try {
            // Simulated steps timing for better UX
            const stepInterval = setInterval(() => {
                setProcessingStep(prev => prev < 3 ? prev + 1 : prev)
            }, 1500)

            const response = await fetch(`${API_URL}/ai-import/extract-products`, {
                method: 'POST',
                headers: getAuthHeaders(true),
                body: formData,
            })

            clearInterval(stepInterval)
            setProcessingStep(4) // Signal complete

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al extraer productos')
            }

            const data = await response.json()
            setExtractedProducts(data.products || [])
            setDetectedCategories(data.categories || [])

            toast({
                title: "Extracción completada",
                description: `Se encontraron ${data.products?.length || 0} productos y ${data.categories?.length || 0} categorías.`,
            })
        } catch (error) {
            console.error('Error uploading document:', error)
            toast({
                title: "Error",
                description: "No se pudo procesar el documento. Intenta con otro formato.",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
            setProcessingStep(0)
        }
    }

    const handleCreateMissingCategories = async () => {
        setCreatingCategories(true)
        const newMap = { ...createdCategoriesMap }
        let createdCount = 0

        try {
            for (const catName of detectedCategories) {
                // Verificar si ya existe en las categorías del sistema o en el mapa de creados
                const exists = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
                if (!exists && !newMap[catName]) {
                    const newCat = await createCategory({ name: catName, description: `Creada automáticamente desde ${file?.name}` })
                    newMap[catName] = newCat.id
                    createdCount++
                } else if (exists) {
                    newMap[catName] = exists.id
                }
            }
            setCreatedCategoriesMap(newMap)
            if (createdCount > 0) {
                toast({
                    title: "Categorías creadas",
                    description: `Se han creado ${createdCount} nuevas categorías.`,
                })
                onCategoryCreated?.()
            }
        } catch (error) {
            toast({
                title: "Error al crear categorías",
                description: "Hubo un problema al crear algunas categorías.",
                variant: "destructive",
            })
        } finally {
            setCreatingCategories(false)
        }
    }

    const handleProductCategoryChange = (index: number, categoryId: string) => {
        const newProducts = [...extractedProducts]
        newProducts[index] = { ...newProducts[index], categoryId }
        setExtractedProducts(newProducts)
    }

    const handleConfirm = () => {
        if (!selectedLocationId) {
            toast({
                title: "Información faltante",
                description: "Debes seleccionar una ubicación para los productos.",
                variant: "destructive",
            })
            return
        }

        const formattedProducts = extractedProducts.map(p => {
            // Priority: 1. Manual selection (p.categoryId), 2. AI detected (linked via createdCategoriesMap or existing), 3. Global fallback
            let finalCategoryId = p.categoryId

            if (!finalCategoryId && p.categoryName) {
                finalCategoryId = createdCategoriesMap[p.categoryName] ||
                    categories.find(c => c.name.toLowerCase() === p.categoryName?.toLowerCase())?.id
            }

            if (!finalCategoryId) {
                finalCategoryId = selectedCategoryId
            }

            return {
                ...p,
                categoryId: finalCategoryId,
                locationId: selectedLocationId,
                isActive: true,
                quantity: 0
            }
        })

        if (formattedProducts.some(p => !p.categoryId)) {
            toast({
                title: "Categorías faltantes",
                description: "Algunos productos no tienen una categoría asignada. Por favor selecciona una categoría para cada uno o una por defecto.",
                variant: "destructive",
            })
            return
        }

        onProductsImported(formattedProducts)
        setExtractedProducts([])
        setDetectedCategories([])
        setCreatedCategoriesMap({})
        setFile(null)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Importar desde Documento</DialogTitle>
                    <DialogDescription>
                        Sube un PDF, una imagen (JPG, PNG, WEBP) o un Excel/Word para que la IA extraiga los productos automáticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                    {!extractedProducts.length ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 gap-4">
                            <Upload className="h-12 w-12 text-muted-foreground" />
                            <div className="text-center">
                                <p className="font-medium">Selecciona un archivo</p>
                                <p className="text-sm text-muted-foreground">PDF, JPG, PNG, WEBP, XLSX, DOCX (Max 10MB)</p>
                            </div>
                            <Input
                                type="file"
                                className="hidden"
                                id="file-upload"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc,.csv,image/*"
                                onChange={handleFileChange}
                            />
                            <Button asChild variant="outline">
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    {file ? file.name : "Examinar archivos"}
                                </label>
                            </Button>
                            {file && (
                                <Button onClick={handleUpload} disabled={loading} className="w-full mt-4 h-auto py-4">
                                    {loading ? (
                                        <div className="flex flex-col items-center gap-3 w-full">
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                            <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                                {steps.map((step, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center gap-2 text-[11px] transition-all duration-500 ${processingStep === idx
                                                                ? "opacity-100 font-bold text-primary translate-x-1"
                                                                : processingStep > idx
                                                                    ? "opacity-50 text-green-600"
                                                                    : "opacity-20"
                                                            }`}
                                                    >
                                                        {processingStep > idx ? <Check className="h-3 w-3" /> : step.icon}
                                                        {step.label}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        "Comenzar Extracción con IA"
                                    )}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <Label>Categoría por defecto</Label>
                                    <select
                                        className="w-full p-2 border rounded-md text-sm"
                                        value={selectedCategoryId}
                                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    >
                                        <option value="">Selecciona una categoría</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        Se usará si un producto no tiene categoría detectada.
                                    </p>
                                </div>
                                {showLocationSelector && (
                                    <div className="space-y-2">
                                        <Label>Ubicación destino</Label>
                                        <select
                                            className="w-full p-2 border rounded-md text-sm"
                                            value={selectedLocationId}
                                            onChange={(e) => setSelectedLocationId(e.target.value)}
                                        >
                                            <option value="">Selecciona una ubicación</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {detectedCategories.length > 0 && (
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4 text-primary" />
                                        Categorías encontradas en el documento
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        He reconocido estas categorías. ¿Deseas crearlas ahora para organizar tus productos automáticamente?
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {detectedCategories.map(cat => {
                                            const exists = categories.find(c => c.name.toLowerCase() === cat.toLowerCase()) || createdCategoriesMap[cat]
                                            return (
                                                <Badge key={cat} variant={exists ? "secondary" : "outline"} className="flex items-center gap-1">
                                                    {cat}
                                                    {exists && <Check className="h-3 w-3" />}
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                        onClick={handleCreateMissingCategories}
                                        disabled={creatingCategories || detectedCategories.every(cat => categories.find(c => c.name.toLowerCase() === cat.toLowerCase()) || createdCategoriesMap[cat])}
                                    >
                                        {creatingCategories ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                                Creando...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="h-3 w-3 mr-2" />
                                                Crear categorías faltantes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Productos Extraídos ({extractedProducts.length})</p>
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setExtractedProducts([])
                                    setDetectedCategories([])
                                }}>
                                    Cambiar archivo
                                </Button>
                            </div>
                            <ScrollArea className="flex-1 border rounded-md p-4 bg-muted/10">
                                <div className="space-y-4">
                                    {extractedProducts.map((product, index) => {
                                        // Auto-calculate current effective category for pre-selection
                                        const detectedId = product.categoryName ? (createdCategoriesMap[product.categoryName] || categories.find(c => c.name.toLowerCase() === product.categoryName?.toLowerCase())?.id) : null
                                        const currentCategoryId = product.categoryId || detectedId || selectedCategoryId || ""

                                        return (
                                            <div key={index} className="flex flex-col gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-medium truncate">{product.name}</p>
                                                            {product.categoryName && (
                                                                <Badge variant="secondary" className="text-[10px] h-4">
                                                                    AI: {product.categoryName}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                                                    </div>
                                                    <Badge variant="outline" className="font-mono text-primary border-primary/30 shrink-0">
                                                        ${product.price ? product.price.toLocaleString() : "0"}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center gap-2 pt-2 border-t mt-1">
                                                    <Label className="text-[10px] uppercase text-muted-foreground w-16">Categoría:</Label>
                                                    <select
                                                        className="flex-1 p-1.5 border rounded-md text-xs bg-muted/20"
                                                        value={currentCategoryId}
                                                        onChange={(e) => handleProductCategoryChange(index, e.target.value)}
                                                    >
                                                        <option value="">Selecciona categoría...</option>
                                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={!extractedProducts.length}>
                        Cargar al Sistema
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
