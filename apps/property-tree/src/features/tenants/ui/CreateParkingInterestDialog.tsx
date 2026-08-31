// import { useState } from 'react'
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from '@/shared/ui/Dialog'
// import { Button } from '@/shared/ui/Button'
// import { PlusCircle } from 'lucide-react'
// import { FormWrapper } from '@/shared/ui/form-wrapper'
// import { useTenantValidation } from '@/hooks/useTenantValidation'
// import { useCreateInterestApplication } from '@/hooks/useCreateInterestApplication'
// import { useToast } from '@/hooks/use-toast'
// import { ParkingSpaceSearch } from './parking-interest/ParkingSpaceSearch'
// import { ApplicationTypeSelection } from '@/shared/rentals/interest-application/ApplicationTypeSelection'
// import { NotesSection } from '@/shared/rentals/interest-application/NotesSection'
// import { ValidationAlerts } from '@/shared/rentals/interest-application/ValidationAlerts'
// import type { ParkingSpaceForPublishing } from '@/hooks/useParkingSpaceListings'

// interface CreateParkingInterestDialogProps {
//   customerNumber: string
//   customerName: string
// }

// export const CreateParkingInterestDialog = ({
//   customerNumber,
//   customerName,
// }: CreateParkingInterestDialogProps) => {
//   const [open, setOpen] = useState(false)
//   const [selectedParkingSpaces, setSelectedParkingSpaces] = useState<
//     ParkingSpaceForPublishing[]
//   >([])
//   const [applicationType, setApplicationType] = useState<
//     'Replace' | 'Additional'
//   >('Additional')
//   const [notes, setNotes] = useState('')

//   const { toast } = useToast()
//   const createApplication = useCreateInterestApplication()

//   const tenantValidation = useTenantValidation(
//     customerNumber,
//     selectedParkingSpaces[0]?.district || '',
//     selectedParkingSpaces[0]?.id || ''
//   )

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     if (selectedParkingSpaces.length === 0) return

//     // Create applications for all selected parking spaces
//     for (const space of selectedParkingSpaces) {
//       try {
//         await createApplication.mutateAsync({
//           parkingSpaceId: space.id,
//           customerNumber,
//           applicationType,
//           notes,
//         })
//       } catch (error) {
//         toast({
//           title: 'Fel',
//           description: `Kunde inte skapa anmälan för ${space.address}`,
//           variant: 'destructive',
//         })
//         return
//       }
//     }

//     // Dispatch event with parking spaces data
//     const event = new CustomEvent('parkingInterestCreated', {
//       detail: { parkingSpaces: selectedParkingSpaces },
//     })
//     window.dispatchEvent(event)

//     toast({
//       title: 'Intresseanmälningar skapade',
//       description: `${selectedParkingSpaces.length} anmälningar för ${customerName} har skapats`,
//     })
//     resetForm()
//     setOpen(false)
//   }

//   const resetForm = () => {
//     setSelectedParkingSpaces([])
//     setApplicationType('Additional')
//     setNotes('')
//   }

//   const tenantHasValidContractForTheDistrict = () => {
//     if (!tenantValidation.data) return false
//     return (
//       tenantValidation.data.hasContractInDistrict ||
//       tenantValidation.data.hasUpcomingContractInDistrict
//     )
//   }

//   const canSubmit =
//     selectedParkingSpaces.length > 0 &&
//     tenantValidation.data?.validationResult !== 'no-contract' &&
//     tenantHasValidContractForTheDistrict() &&
//     !createApplication.isPending

//   return (
//     <Dialog
//       open={open}
//       onOpenChange={(isOpen) => {
//         setOpen(isOpen)
//         if (!isOpen) resetForm()
//       }}
//     >
//       <DialogTrigger asChild>
//         <Button variant="outline" className="w-full">
//           <PlusCircle className="h-4 w-4 mr-2" />
//           Ny intresseanmälan bilplats
//         </Button>
//       </DialogTrigger>
//       <DialogContent className="max-w-3xl max-h-[90vh] p-0">
//         <DialogHeader className="p-6 pb-0">
//           <DialogTitle className="text-xl font-semibold text-left">
//             Ny intresseanmälan bilplats - {customerName}
//           </DialogTitle>
//         </DialogHeader>

//         <FormWrapper onSubmit={handleSubmit} maxHeight="70vh">
//           <ParkingSpaceSearch
//             selectedParkingSpaces={selectedParkingSpaces}
//             onParkingSpaceSelect={setSelectedParkingSpaces}
//           />

//           {selectedParkingSpaces.length > 0 && tenantValidation.data && (
//             <>
//               <ValidationAlerts tenantValidation={tenantValidation.data} />

//               <ApplicationTypeSelection
//                 applicationType={applicationType}
//                 onApplicationTypeChange={setApplicationType}
//                 tenantValidation={tenantValidation.data}
//               />

//               <NotesSection notes={notes} onNotesChange={setNotes} />
//             </>
//           )}

//           <div className="flex justify-between gap-4 pt-4 border-t border-border">
//             <Button
//               variant="outline"
//               type="button"
//               onClick={() => setOpen(false)}
//               disabled={createApplication.isPending}
//               className="flex-1"
//             >
//               Avbryt
//             </Button>
//             <Button type="submit" disabled={!canSubmit} className="flex-1">
//               {createApplication.isPending
//                 ? 'Skapar...'
//                 : `Lägg till (${selectedParkingSpaces.length})`}
//             </Button>
//           </div>
//         </FormWrapper>
//       </DialogContent>
//     </Dialog>
//   )
// }
