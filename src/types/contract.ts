export type ContractStatus = 'Active' | 'Upcoming' | 'Ended' | 'Voided'
export type BookingType = 'Term' | 'Ad-hoc'

export interface Trip {
  id: string
  tripType: 'Fixed' | 'One-day' | 'Shuttle'
  startTime: string
  capacity: number
  activeDays: string
  linkedRoute: string
}

export interface OtherCharge {
  id: string
  description: string
  quantity: number
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
}
