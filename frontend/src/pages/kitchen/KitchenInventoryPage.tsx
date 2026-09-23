import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useProducts } from '@/hooks/useProducts'
import {
  addKitchenStock,
  createKitchenIngredient,
  listKitchenIngredients,
  listKitchenRecipes,
  logKitchenWastage,
  saveKitchenRecipeLine,
  type KitchenIngredient,
} from '@/services/kitchenInventoryService'
import { toastError } from '@/utils/userMessage'
import toast from 'react-hot-toast'

const stockTone = (row: KitchenIngredient) => {
  if (row.currentStock <= 0) return 'danger' as const
  if (row.currentStock <= row.lowStockThreshold) return 'warning' as const
  return 'success' as const
}

export const KitchenInventoryPage = () => {
  const queryClient = useQueryClient()
  const { data: products = [] } = useProducts()
  const ingredientsQuery = useQuery({
    queryKey: ['kitchen-ingredients'],
    queryFn: listKitchenIngredients,
  })
  const recipesQuery = useQuery({
    queryKey: ['kitchen-recipes'],
    queryFn: listKitchenRecipes,
  })
  const ingredients = ingredientsQuery.data ?? []
  const recipes = recipesQuery.data ?? []

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('g')
  const [opening, setOpening] = useState('0')
  const [threshold, setThreshold] = useState('0')
  const [stockQty, setStockQty] = useState<Record<string, string>>({})
  const [supplier, setSupplier] = useState<Record<string, string>>({})
  const [wasteQty, setWasteQty] = useState<Record<string, string>>({})
  const [wasteReason, setWasteReason] = useState<Record<string, string>>({})
  const [recipeProduct, setRecipeProduct] = useState('')
  const [recipeIngredient, setRecipeIngredient] = useState('')
  const [recipeQty, setRecipeQty] = useState('1')

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['kitchen-ingredients'] })
    queryClient.invalidateQueries({ queryKey: ['kitchen-recipes'] })
  }

  const createMut = useMutation({
    mutationFn: createKitchenIngredient,
    onSuccess: () => {
      setName('')
      refresh()
      toast.success('Ingredient added')
    },
    onError: (err) => toastError(err, 'Could not add ingredient'),
  })

  const stockMut = useMutation({
    mutationFn: ({ id, quantity, supplierName }: { id: string; quantity: number; supplierName?: string }) =>
      addKitchenStock(id, { quantity, supplierName, asPurchase: true }),
    onSuccess: () => {
      refresh()
      toast.success('Stock added')
    },
    onError: (err) => toastError(err, 'Could not add stock'),
  })

  const wasteMut = useMutation({
    mutationFn: logKitchenWastage,
    onSuccess: () => {
      refresh()
      toast.success('Wastage logged')
    },
    onError: (err) => toastError(err, 'Could not log wastage'),
  })

  const recipeMut = useMutation({
    mutationFn: saveKitchenRecipeLine,
    onSuccess: () => {
      refresh()
      toast.success('Recipe line saved')
    },
    onError: (err) => toastError(err, 'Could not save recipe'),
  })

  const productName = (id: string) => products.find((p) => p.id === id)?.name || id
  const ingredientName = (id: string) => ingredients.find((i) => i.id === id)?.name || id

  return (
    <div className="space-y-6">
      <PageHeader title="Kitchen Inventory" />
      <p className="text-sm text-gray-500 -mt-2">Ingredients, recipes, and wastage. Stock drops when a KOT is billed.</p>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add ingredient</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Input label="Opening stock" type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
          <Input label="Low stock at" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!name.trim() || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  name: name.trim(),
                  unit: unit.trim() || 'g',
                  currentStock: Number(opening) || 0,
                  lowStockThreshold: Number(threshold) || 0,
                })
              }
            >
              Add
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="p-3">Ingredient</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Add stock</th>
              <th className="p-3">Log wastage</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.length === 0 ? (
              <tr>
                <td className="p-6 text-gray-500" colSpan={4}>
                  No kitchen ingredients yet. Add flour, oil, or other items used by recipes.
                </td>
              </tr>
            ) : (
              ingredients.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                  <td className="p-3">
                    <p className="font-medium">{row.name}</p>
                    <Badge variant={stockTone(row)}>
                      {row.currentStock <= 0 ? 'Out' : row.currentStock <= row.lowStockThreshold ? 'Low' : 'In stock'}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {row.currentStock} {row.unit}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={stockQty[row.id] || ''}
                        onChange={(e) => setStockQty((s) => ({ ...s, [row.id]: e.target.value }))}
                      />
                      <Input
                        placeholder="Supplier"
                        value={supplier[row.id] || ''}
                        onChange={(e) => setSupplier((s) => ({ ...s, [row.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          stockMut.mutate({
                            id: row.id,
                            quantity: Number(stockQty[row.id]) || 0,
                            supplierName: supplier[row.id],
                          })
                        }
                      >
                        Add
                      </Button>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={wasteQty[row.id] || ''}
                        onChange={(e) => setWasteQty((s) => ({ ...s, [row.id]: e.target.value }))}
                      />
                      <Input
                        placeholder="Reason"
                        value={wasteReason[row.id] || ''}
                        onChange={(e) => setWasteReason((s) => ({ ...s, [row.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          wasteMut.mutate({
                            ingredientId: row.id,
                            quantity: Number(wasteQty[row.id]) || 0,
                            reason: wasteReason[row.id],
                          })
                        }
                      >
                        Log
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recipe line</h3>
        <p className="text-sm text-gray-500">How much of an ingredient one menu item uses. Deducted when the bill is generated.</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-600">Menu item</span>
            <select className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-dark-elevated" value={recipeProduct} onChange={(e) => setRecipeProduct(e.target.value)}>
              <option value="">Select</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-gray-600">Ingredient</span>
            <select className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-dark-elevated" value={recipeIngredient} onChange={(e) => setRecipeIngredient(e.target.value)}>
              <option value="">Select</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </label>
          <Input label="Qty per item" type="number" value={recipeQty} onChange={(e) => setRecipeQty(e.target.value)} />
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!recipeProduct || !recipeIngredient || recipeMut.isPending}
              onClick={() =>
                recipeMut.mutate({
                  productId: recipeProduct,
                  ingredientId: recipeIngredient,
                  quantity: Number(recipeQty) || 0,
                })
              }
            >
              Save line
            </Button>
          </div>
        </div>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          {recipes.map((line) => (
            <li key={line.id}>
              {productName(line.productId)} uses {line.quantity} {ingredients.find((i) => i.id === line.ingredientId)?.unit || ''} {ingredientName(line.ingredientId)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
