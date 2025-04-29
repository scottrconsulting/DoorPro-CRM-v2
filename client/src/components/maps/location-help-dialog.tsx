import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import { InfoIcon } from 'lucide-react'

interface LocationHelpDialogProps {
  open: boolean
  onClose: () => void
}

const LocationHelpDialog: React.FC<LocationHelpDialogProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-500" />
            Location Services Information
          </DialogTitle>
          <DialogDescription>
            For the best experience using the maps in this application
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p>
            We've noticed that location services may not be available or enabled in your current environment.
          </p>
          
          <p>
            <strong>Why this happens:</strong>
          </p>
          
          <ul className="list-disc pl-5 space-y-2">
            <li>
              In preview environments like Replit, geolocation access is typically restricted
            </li>
            <li>
              Your browser may have denied or blocked location permissions
            </li>
            <li>
              You may be using a device that doesn't have GPS capabilities
            </li>
          </ul>
          
          <p className="text-sm text-muted-foreground mt-4">
            <strong>What we've done:</strong> We've set a default location in Nebraska, USA to ensure the map displays properly.
          </p>
          
          <p className="text-sm text-muted-foreground">
            <strong>What you can do:</strong> When using the app in a regular browser, make sure to allow location permissions when prompted for the best experience.
          </p>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LocationHelpDialog