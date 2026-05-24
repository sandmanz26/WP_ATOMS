export type ContractStatus = 'Active' | 'Upcoming' | 'Ended' | 'Voided'
export type BookingType = 'Term' | 'Ad-hoc'

export interface Trip {
  id: string
  tripType: 'Fixed' | 'One-day' | 'Shuttle'
  startTime: string
  capacity: number
  activeDays: string
  linkedRoute: string
  startDate?: string
  endDate?: string
  tripDescription?: string
  tripPrice?: number | null
  tripStatus?: string
}

export interface OtherCharge {
  id: string
  description: string
  quantity: number
  unitPrice?: number
  amount?: number
  itemRemarks?: string
}

export interface Contract {
  id: string
  contractNo: string
  customerCode: string
  contractGroup: string
  bookingType: BookingType
  price: number | null
  contractTitle: string
  contractPeriodStart: string
  contractPeriodEnd: string | null
  createdBy: string
  status: ContractStatus
  lastUpdatedOn: string
  createdOn: string
  lastUpdatedBy: string
  contractRemark: string
  trips: Trip[]
  otherCharges: OtherCharge[]
  priceType?: 'Per Month' | 'Per Trip' | 'Per Day' | 'Lump Sum' | 'Once-off'
  effectiveMonth?: string
  companyName?: string
  address?: string
  picName?: string
  picContact?: string
  picEmail?: string
  billingCompany?: string
  accountPayable?: string
  invoiceGenerationDate?: string
  invoiceDate?: string
  paymentTerms?: string
  terminationNotice?: number
  discount?: number
  discountType?: '$' | '%'
  discountReason?: string
  surcharge?: number
  surchargeType?: '$' | '%'
  surchargeReason?: string
}
