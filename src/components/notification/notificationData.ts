import type { ContractStatus } from '@/types/contract'

export type { ContractStatus }

export type NotificationStatus = 'Pending Assignment' | 'Ready to Send' | 'Partially Sent' | 'Completed'
export type TripNotificationStatus = 'Pending Assignment' | 'Ready to Sent' | 'Resend Required' | 'Sent'

export interface TripNotification {
  date: string
  startTime: string
  driver: string
  vehicle: string
  notificationStatus: TripNotificationStatus
}

export interface CustomerNotification {
  id: string
  contractNo: string
  customerCode: string
  contractPeriod: string
  contractTitle: string
  contractStatus: ContractStatus
  notificationStatus: NotificationStatus
  sentCount: number
  totalCount: number
  lastUpdatedOn: string
  lastUpdatedAgo: string
  phoneNumber: string
  email: string
  emailCc: string
  trips: TripNotification[]
  createdOn: string
  createdBy: string
  lastUpdatedBy: string
}

const sampleTrips: TripNotification[] = [
  { date: '16 Jun 2026', startTime: '07:00 AM', driver: 'Ahmad Rizal', vehicle: 'SBS1234A', notificationStatus: 'Sent' },
  { date: '16 Jun 2026', startTime: '01:00 PM', driver: 'Ahmad Rizal', vehicle: 'SBS1234A', notificationStatus: 'Sent' },
  { date: '17 Jun 2026', startTime: '07:00 AM', driver: 'Lim Wei Jie', vehicle: 'SBS5678B', notificationStatus: 'Resend Required' },
  { date: '17 Jun 2026', startTime: '01:00 PM', driver: 'Lim Wei Jie', vehicle: 'SBS5678B', notificationStatus: 'Ready to Sent' },
  { date: '18 Jun 2026', startTime: '07:00 AM', driver: '-', vehicle: '-', notificationStatus: 'Pending Assignment' },
]

function makeTrips(sentCount: number, totalCount: number): TripNotification[] {
  const trips: TripNotification[] = []
  for (let i = 0; i < totalCount; i++) {
    trips.push({
      date: `${16 + Math.floor(i / 2)} Jun 2026`,
      startTime: i % 2 === 0 ? '07:00 AM' : '01:00 PM',
      driver: i < sentCount + 1 ? (i % 2 === 0 ? 'Ahmad Rizal' : 'Lim Wei Jie') : '-',
      vehicle: i < sentCount + 1 ? (i % 2 === 0 ? 'SBS1234A' : 'SBS5678B') : '-',
      notificationStatus: i < sentCount ? 'Sent' : i === sentCount ? 'Ready to Sent' : 'Pending Assignment',
    })
  }
  return trips
}

export const NOTIFICATIONS: CustomerNotification[] = [
  {
    id: '1', contractNo: 'CC-2026-0142', customerCode: 'CUST-SBL', contractPeriod: '18 Jun 2026 - 20 Jun 2026',
    contractTitle: 'Sembawang Logistics - Port Transfer (3 Days)', contractStatus: 'Voided', notificationStatus: 'Pending Assignment',
    sentCount: 0, totalCount: 10, lastUpdatedOn: '19 Mar 2026', lastUpdatedAgo: '3 months ago',
    phoneNumber: '(+65) 9123 4501', email: 'ops@sembawanglogistics.com.sg', emailCc: 'admin@sembawanglogistics.com.sg',
    trips: makeTrips(0, 10), createdOn: '1 Mar 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '2', contractNo: 'CC-2026-0138', customerCode: 'CUST-GLP', contractPeriod: '17 Jun 2026 - 19 Jun 2026',
    contractTitle: 'GLP Industrial - Warehouse Relocation', contractStatus: 'Voided', notificationStatus: 'Pending Assignment',
    sentCount: 0, totalCount: 11, lastUpdatedOn: '22 Dec 2026', lastUpdatedAgo: '5 months ago',
    phoneNumber: '(+65) 9123 4502', email: 'logistics@glp.com.sg', emailCc: 'admin@glp.com.sg',
    trips: makeTrips(0, 11), createdOn: '1 Mar 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Jasmine Tan',
  },
  {
    id: '3', contractNo: 'CC-2026-0135', customerCode: 'CUST-KPL', contractPeriod: '16 Jun 2026 - 22 Jun 2026',
    contractTitle: 'Keppel Infra - Site Crew Daily Transfer - Permission TAOF', contractStatus: 'Upcoming', notificationStatus: 'Ready to Send',
    sentCount: 2, totalCount: 5, lastUpdatedOn: '15 Jun 2026', lastUpdatedAgo: '1 week ago',
    phoneNumber: '(+65) 91234567', email: 'daniel.tan@keppelinfra.com.sg', emailCc: 'sales.tan@keppelinfra.com.sg, marco.antoni@keeplinfra.com.sg, Romadio.tonio@keeplinfra',
    trips: sampleTrips, createdOn: '27 Sep 2025, 2:03pm', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '4', contractNo: 'CC-2026-0131', customerCode: 'CUST-MBK', contractPeriod: '15 Jun 2026 - 17 Jun 2026',
    contractTitle: 'Mapletree Biz City - Event Shuttle Service', contractStatus: 'Upcoming', notificationStatus: 'Ready to Send',
    sentCount: 0, totalCount: 5, lastUpdatedOn: '14 Jun 2026', lastUpdatedAgo: '1 week ago',
    phoneNumber: '(+65) 9123 4504', email: 'events@mapletree.com.sg', emailCc: 'admin@mapletree.com.sg',
    trips: makeTrips(0, 5), createdOn: '1 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Marcus Lim',
  },
  {
    id: '5', contractNo: 'CC-2026-0127', customerCode: 'CUST-YCH', contractPeriod: '14 Jun 2026 - 18 Jun 2026',
    contractTitle: 'YCH Group - Cross-dock Pickup (Jurong)', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 5, totalCount: 5, lastUpdatedOn: '18 Jun 2026', lastUpdatedAgo: '5 days ago',
    phoneNumber: '(+65) 9123 4505', email: 'ops@ych.com.sg', emailCc: 'admin@ych.com.sg',
    trips: makeTrips(5, 5), createdOn: '1 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '6', contractNo: 'CC-2026-0119', customerCode: 'CUST-PSA', contractPeriod: '10 Jun 2026 - 14 Jun 2026',
    contractTitle: 'Sembawang Logistics - Container Drayage', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 6, totalCount: 6, lastUpdatedOn: '14 Jun 2026', lastUpdatedAgo: '9 days ago',
    phoneNumber: '(+65) 9123 4506', email: 'ops@sembawanglogistics.com.sg', emailCc: 'admin@sembawanglogistics.com.sg',
    trips: makeTrips(6, 6), createdOn: '25 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Jasmine Tan',
  },
  {
    id: '7', contractNo: 'CC-2026-0112', customerCode: 'CUST-DHL', contractPeriod: '8 Jun 2026 - 12 Jun 2026',
    contractTitle: 'PSA Corp - Tuas Terminal Staff Transfer', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 8, totalCount: 8, lastUpdatedOn: '12 Jun 2026', lastUpdatedAgo: '11 days ago',
    phoneNumber: '(+65) 9123 4507', email: 'transfer@psacorp.com.sg', emailCc: 'admin@psacorp.com.sg',
    trips: makeTrips(8, 8), createdOn: '20 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Marcus Lim',
  },
  {
    id: '8', contractNo: 'CC-2026-0108', customerCode: 'CUST-CAP', contractPeriod: '5 Jun 2026 - 9 Jun 2026',
    contractTitle: 'DHL Supply Chain - Ad-hoc Delivery Run', contractStatus: 'Active', notificationStatus: 'Partially Sent',
    sentCount: 6, totalCount: 9, lastUpdatedOn: '9 Jun 2026', lastUpdatedAgo: '2 weeks ago',
    phoneNumber: '(+65) 9123 4508', email: 'delivery@dhl.com.sg', emailCc: 'admin@dhl.com.sg',
    trips: makeTrips(6, 9), createdOn: '15 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '9', contractNo: 'CC-2026-0145', customerCode: 'CUST-STG', contractPeriod: '20 Jun 2026 - 25 Jun 2026',
    contractTitle: 'CapitaLand - Tenant Move-in Support', contractStatus: 'Active', notificationStatus: 'Ready to Send',
    sentCount: 5, totalCount: 10, lastUpdatedOn: '20 Jun 2026', lastUpdatedAgo: '3 days ago',
    phoneNumber: '(+65) 9123 4509', email: 'moveins@capitaland.com.sg', emailCc: 'admin@capitaland.com.sg',
    trips: makeTrips(5, 10), createdOn: '10 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Jasmine Tan',
  },
  {
    id: '10', contractNo: 'CC-2026-0099', customerCode: 'CUST-0027', contractPeriod: '1 Jun 2026 - 7 Jun 2026',
    contractTitle: 'ST Engineering - Equipment Transport', contractStatus: 'Active', notificationStatus: 'Ready to Send',
    sentCount: 10, totalCount: 11, lastUpdatedOn: '7 Jun 2026', lastUpdatedAgo: '2 weeks ago',
    phoneNumber: '(+65) 9123 4510', email: 'equipment@stengg.com', emailCc: 'admin@stengg.com',
    trips: makeTrips(10, 11), createdOn: '25 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Marcus Lim',
  },
  {
    id: '11', contractNo: 'CC-2026-0091', customerCode: 'CUST-JTC', contractPeriod: '28 May 2026 - 1 Jun 2026',
    contractTitle: 'JTC Corporation - Industrial Estate Shuttle', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 7, totalCount: 7, lastUpdatedOn: '1 Jun 2026', lastUpdatedAgo: '3 weeks ago',
    phoneNumber: '(+65) 9123 4511', email: 'shuttle@jtc.gov.sg', emailCc: 'admin@jtc.gov.sg',
    trips: makeTrips(7, 7), createdOn: '15 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '12', contractNo: 'CC-2026-0087', customerCode: 'CUST-NUS', contractPeriod: '25 May 2026 - 30 May 2026',
    contractTitle: 'NUS - Summer School Shuttle Service', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 12, totalCount: 12, lastUpdatedOn: '30 May 2026', lastUpdatedAgo: '3 weeks ago',
    phoneNumber: '(+65) 9123 4512', email: 'transport@nus.edu.sg', emailCc: 'admin@nus.edu.sg',
    trips: makeTrips(12, 12), createdOn: '1 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Jasmine Tan',
  },
  {
    id: '13', contractNo: 'CC-2026-0154', customerCode: 'CUST-RWS', contractPeriod: '25 Jun 2026 - 30 Jun 2026',
    contractTitle: 'Resorts World Sentosa - Staff Night Shuttle', contractStatus: 'Upcoming', notificationStatus: 'Pending Assignment',
    sentCount: 0, totalCount: 8, lastUpdatedOn: '18 Jun 2026', lastUpdatedAgo: '5 days ago',
    phoneNumber: '(+65) 9123 4513', email: 'staff@rws.com.sg', emailCc: 'admin@rws.com.sg',
    trips: makeTrips(0, 8), createdOn: '10 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Marcus Lim',
  },
  {
    id: '14', contractNo: 'CC-2026-0121', customerCode: 'CUST-CWT', contractPeriod: '11 Jun 2026 - 15 Jun 2026',
    contractTitle: 'CWT Commodities - Warehouse Staff Transfer', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 6, totalCount: 6, lastUpdatedOn: '15 Jun 2026', lastUpdatedAgo: '1 week ago',
    phoneNumber: '(+65) 9123 4514', email: 'transfer@cwt.com.sg', emailCc: 'admin@cwt.com.sg',
    trips: makeTrips(6, 6), createdOn: '1 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '15', contractNo: 'CC-2026-0159', customerCode: 'CUST-SIA', contractPeriod: '28 Jun 2026 - 3 Jul 2026',
    contractTitle: 'SIA Engineering - Crew Airport Transfer', contractStatus: 'Upcoming', notificationStatus: 'Ready to Send',
    sentCount: 0, totalCount: 7, lastUpdatedOn: '20 Jun 2026', lastUpdatedAgo: '3 days ago',
    phoneNumber: '(+65) 9123 4515', email: 'crew@siaec.com.sg', emailCc: 'admin@siaec.com.sg',
    trips: makeTrips(0, 7), createdOn: '12 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Jasmine Tan',
  },
  {
    id: '16', contractNo: 'CC-2026-0104', customerCode: 'CUST-CAP', contractPeriod: '3 Jun 2026 - 8 Jun 2026',
    contractTitle: 'CapitaLand - Retail Staff Shuttle', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 9, totalCount: 9, lastUpdatedOn: '8 Jun 2026', lastUpdatedAgo: '2 weeks ago',
    phoneNumber: '(+65) 9123 4516', email: 'moveins@capitaland.com.sg', emailCc: 'admin@capitaland.com.sg',
    trips: makeTrips(9, 9), createdOn: '20 May 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Marcus Lim',
  },
  {
    id: '17', contractNo: 'CC-2026-0148', customerCode: 'CUST-DBS', contractPeriod: '22 Jun 2026 - 26 Jun 2026',
    contractTitle: 'DBS Bank - Data Centre Shuttle Service', contractStatus: 'Active', notificationStatus: 'Partially Sent',
    sentCount: 3, totalCount: 8, lastUpdatedOn: '22 Jun 2026', lastUpdatedAgo: '1 day ago',
    phoneNumber: '(+65) 9123 4517', email: 'facilities@dbs.com.sg', emailCc: 'admin@dbs.com.sg',
    trips: makeTrips(3, 8), createdOn: '15 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Deve Tano',
  },
  {
    id: '18', contractNo: 'CC-2026-0116', customerCode: 'CUST-SEM', contractPeriod: '9 Jun 2026 - 13 Jun 2026',
    contractTitle: 'Sembcorp Marine - Yard Crew Transfer', contractStatus: 'Ended', notificationStatus: 'Completed',
    sentCount: 6, totalCount: 6, lastUpdatedOn: '13 Jun 2026', lastUpdatedAgo: '9 days ago',
    phoneNumber: '(+65) 9123 4518', email: 'yard@sembmarine.com.sg', emailCc: 'admin@sembmarine.com.sg',
    trips: makeTrips(6, 6), createdOn: '1 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Jasmine Tan',
  },
  {
    id: '19', contractNo: 'CC-2026-0162', customerCode: 'CUST-CWT', contractPeriod: '30 Jun 2026 - 4 Jul 2026',
    contractTitle: 'CWT Commodities - Weekend Warehouse Run', contractStatus: 'Upcoming', notificationStatus: 'Pending Assignment',
    sentCount: 0, totalCount: 4, lastUpdatedOn: '21 Jun 2026', lastUpdatedAgo: '2 days ago',
    phoneNumber: '(+65) 9123 4519', email: 'transfer@cwt.com.sg', emailCc: 'admin@cwt.com.sg',
    trips: makeTrips(0, 4), createdOn: '18 Jun 2026, 9:00am', createdBy: 'System', lastUpdatedBy: 'Marcus Lim',
  },
]
