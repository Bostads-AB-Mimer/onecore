// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/shared/ui/select'
// import { Label } from '@/shared/ui/label'

// interface TenantSelectionFiltersProps {
//   contractStatusFilter: string
//   setContractStatusFilter: (value: string) => void
//   contractTypeFilter: string
//   setContractTypeFilter: (value: string) => void
//   customerTypeFilter: string
//   setCustomerTypeFilter: (value: string) => void
// }

// export function TenantSelectionFilters({
//   contractStatusFilter,
//   setContractStatusFilter,
//   contractTypeFilter,
//   setContractTypeFilter,
//   customerTypeFilter,
//   setCustomerTypeFilter,
// }: TenantSelectionFiltersProps) {
//   return (
//     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//       <div className="space-y-2">
//         <Label htmlFor="customerType">Kundtyp</Label>
//         <Select
//           value={customerTypeFilter}
//           onValueChange={setCustomerTypeFilter}
//         >
//           <SelectTrigger id="customerType">
//             <SelectValue placeholder="Alla typer" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="all">Alla typer</SelectItem>
//             <SelectItem value="tenant">Hyresgäst</SelectItem>
//             <SelectItem value="applicant">Sökande</SelectItem>
//           </SelectContent>
//         </Select>
//       </div>

//       <div className="space-y-2">
//         <Label htmlFor="contractStatus">Kontraktstatus</Label>
//         <Select
//           value={contractStatusFilter}
//           onValueChange={setContractStatusFilter}
//         >
//           <SelectTrigger id="contractStatus">
//             <SelectValue placeholder="Alla statusar" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="all">Alla statusar</SelectItem>
//             <SelectItem value="active">Aktivt</SelectItem>
//             <SelectItem value="expiring">Utgående</SelectItem>
//             <SelectItem value="expired">Utgånget</SelectItem>
//             <SelectItem value="vacant">Vakant</SelectItem>
//           </SelectContent>
//         </Select>
//       </div>

//       <div className="space-y-2">
//         <Label htmlFor="contractType">Kontraktstyp</Label>
//         <Select
//           value={contractTypeFilter}
//           onValueChange={setContractTypeFilter}
//         >
//           <SelectTrigger id="contractType">
//             <SelectValue placeholder="Alla typer" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="all">Alla typer</SelectItem>
//             <SelectItem value="housing">Bostad</SelectItem>
//             <SelectItem value="parking">Parkering</SelectItem>
//             <SelectItem value="commercial">Lokal</SelectItem>
//           </SelectContent>
//         </Select>
//       </div>
//     </div>
//   )
// }
