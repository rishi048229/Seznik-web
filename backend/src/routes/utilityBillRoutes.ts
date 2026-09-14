import express from 'express'
import {
  extractUtilityBill,
  getUtilityBills,
  getUtilityBillStats,
  createUtilityBill,
  deleteUtilityBill,
} from '../controllers/utilityBillController'
import { protect } from '../middlewares/authMiddleware'
import { requirePermission } from '../middlewares/requirePermission'

const router = express.Router()

router.use(protect)
router.use(requirePermission('canAccessSales'))

router.post('/extract', extractUtilityBill)
router.get('/stats', getUtilityBillStats)
router.get('/', getUtilityBills)
router.post('/', createUtilityBill)
router.delete('/:id', deleteUtilityBill)

export default router
