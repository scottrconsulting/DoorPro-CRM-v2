import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Contact, User } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ContactDetailModal from "@/components/contacts/contact-detail-modal";

interface ContactListProps {
  title?: string;
}

export default function ContactList({ title = "Recent Contacts" }: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [_, setLocation] = useLocation();

  // Fetch contacts
  const { data: contacts = [], isLoading, refetch } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    return contacts.filter(
      (contact) =>
        contact.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.address.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [contacts, searchQuery]);

  // Generate status badge based on contact status
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      interested: {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        label: "Interested",
      },
      not_interested: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-300",
        label: "Not interested",
      },
      converted: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-300",
        label: "Converted",
      },
      considering: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-800 dark:text-yellow-300",
        label: "Considering",
      },
    };

    const { bg, text, label } = config[status] || {
      bg: "bg-gray-100 dark:bg-gray-800/50",
      text: "text-gray-800 dark:text-gray-300",
      label: status,
    };

    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bg} ${text} mr-2`}>
        {label}
      </span>
    );
  };

  // Format contact timestamp
  const formatTime = (timestamp: Date) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  // Get follow-up text based on status
  const getFollowUpText = (status: string) => {
    const config: Record<string, string> = {
      interested: "Follow up in 2 days",
      considering: "Requested more info",
      converted: "Sale completed",
      not_interested: "Do not contact",
    };

    return config[status] || "";
  };

  // Handle contact click
  const handleContactClick = (contactId: number) => {
    setSelectedContactId(contactId);
  };

  // Close modal
  const handleCloseModal = () => {
    setSelectedContactId(null);
  };

  return (
    <>
      <div className="bg-background rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-medium text-foreground">{title}</h2>
          <div className="flex items-center">
            <div className="relative mr-2">
              <Input
                type="text"
                placeholder="Search contacts..."
                className="w-48 pl-8 pr-2 py-1 text-sm"
                onChange={(e) => setSearchQuery(e.target.value)}
                value={searchQuery}
              />
              <span className="material-icons text-muted-foreground absolute left-2 top-1/2 transform -translate-y-1/2 text-sm">
                search
              </span>
            </div>
            <button 
              onClick={() => refetch()} 
              className="mr-2 p-1 rounded hover:bg-muted text-muted-foreground"
              title="Refresh contacts"
            >
              <span className="material-icons text-sm">refresh</span>
            </button>
            <Link href="/contacts" className="text-sm text-primary hover:text-primary/90">
              View All
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No contacts found</p>
            <Link href="/contacts" className="mt-2 inline-block text-primary hover:underline">
              Add your first contact
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {filteredContacts.slice(0, 4).map((contact) => (
              <div
                key={contact.id}
                className="px-4 py-3 hover:bg-muted/50 cursor-pointer"
                onClick={() => handleContactClick(contact.id)}
              >
                <div className="flex items-center">
                  <div 
                    className={`h-10 w-10 flex-shrink-0 ${
                      contact.status === "converted" ? "bg-success" :
                      contact.status === "interested" ? "bg-primary-light" :
                      contact.status === "considering" ? "bg-secondary-light" :
                      "bg-muted"
                    } text-white rounded-full flex items-center justify-center`}
                  >
                    <span className="material-icons">person</span>
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground">
                        {contact.fullName}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(contact.updatedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{contact.address}</p>
                    <div className="mt-1 flex items-center">
                      {getStatusBadge(contact.status)}
                      <span className="text-xs text-muted-foreground">
                        {getFollowUpText(contact.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border px-4 py-3 bg-muted/50">
          <div className="text-center">
            <Link href="/contacts" className="px-3 py-1 border border-border rounded text-sm text-foreground hover:bg-muted inline-block">
              View All Contacts
            </Link>
          </div>
        </div>
      </div>

      {selectedContactId && (
        <ContactDetailModal
          contactId={selectedContactId}
          isOpen={true}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
