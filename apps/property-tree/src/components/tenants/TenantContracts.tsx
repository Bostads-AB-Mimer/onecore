// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
// } from '@/components/ui/v2/Card'
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from '@/components/ui/v2/Table'
// import { Badge } from '@/components/ui/v2/Badge'
// import { Button } from '@/components/ui/v2/Button'
// import { Contract } from '@/data/contracts'

// interface TenantContractsProps {
//   contracts: Contract[]
// }

// export function TenantContracts({ contracts }: TenantContractsProps) {
//   if (!contracts.length) {
//     return null
//   }

//   const getContractTypeName = (type: Contract['type']) => {
//     switch (type) {
//       case 'housing':
//         return 'Bostad'
//       case 'parking':
//         return 'Bilplats'
//       case 'storage':
//         return 'Förråd'
//       default:
//         return 'Övrigt'
//     }
//   }

//   const getContractCategory = (type: Contract['type']) => {
//     switch (type) {
//       case 'housing':
//         return 'Korttid'
//       case 'parking':
//         return 'Poängfri'
//       case 'storage':
//         return ''
//       default:
//         return ''
//     }
//   }

//   const getStatusBadge = (status: Contract['status']) => {
//     switch (status) {
//       case 'active':
//         return (
//           <Badge
//             variant="outline"
//             className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
//           >
//             Aktiv
//           </Badge>
//         )
//       case 'pending':
//         return (
//           <Badge
//             variant="outline"
//             className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200"
//           >
//             Pågående
//           </Badge>
//         )
//       case 'terminated':
//         return (
//           <Badge
//             variant="outline"
//             className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
//           >
//             Uppsagt
//           </Badge>
//         )
//       default:
//         return null
//     }
//   }

//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString('sv-SE')
//   }

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat('sv-SE', {
//       style: 'currency',
//       currency: 'SEK',
//       maximumFractionDigits: 0,
//     }).format(amount)
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Kontrakt</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <Table>
//           <TableHeader>
//             <TableRow>
//               <TableHead>Typ</TableHead>
//               <TableHead>Kontraktsnummer</TableHead>
//               <TableHead>Objekt</TableHead>
//               <TableHead>Startdatum</TableHead>
//               <TableHead>Månadshyra</TableHead>
//               <TableHead>Kontrakttyp</TableHead>
//               <TableHead>Status</TableHead>
//               <TableHead></TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {contracts.map((contract) => (
//               <TableRow key={contract.id}>
//                 <TableCell>
//                   <div className="flex items-center">
//                     <span>{getContractTypeName(contract.type)}</span>
//                   </div>
//                 </TableCell>
//                 <TableCell>{contract.id}</TableCell>
//                 <TableCell>{contract.objectName}</TableCell>
//                 <TableCell>
//                   <div>{formatDate(contract.startDate)}</div>
//                 </TableCell>
//                 <TableCell>{formatCurrency(contract.rent)}</TableCell>
//                 <TableCell>{getContractCategory(contract.type)}</TableCell>
//                 <TableCell>{getStatusBadge(contract.status)}</TableCell>
//                 <TableCell>
//                   <Button variant="outline" size="sm">
//                     Visa kontrakt
//                   </Button>
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </CardContent>
//     </Card>
//   )
// }
