import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Extend the User type to include isManager
declare module "@/hooks/use-auth" {
  interface User {
    isManager?: boolean;
  }
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Loader2, 
  SendHorizontal, 
  PlusCircle, 
  MoreVertical, 
  Search, 
  AlertCircle, 
  Hash, 
  MessageSquare, 
  Bell, 
  BellOff, 
  UserPlus, 
  Users, 
  ChevronDown,
  MessageCircle
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define the types for our data
interface Conversation {
  id: number;
  name: string | null;
  teamId: number | null;
  isTeamChannel: boolean;
  createdAt: string;
  updatedAt: string;
  isChannelType?: boolean;
  channelTag?: string | null;
  isPublic?: boolean;
  creatorId?: number | null;
}

interface Participant {
  id: number;
  conversationId: number;
  userId: number;
  isAdmin: boolean;
  lastReadTimestamp: string | null;
  createdAt: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    isManager: boolean;
  } | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  attachmentUrl: string | null;
  isRead: boolean;
  isUrgent: boolean;
  createdAt: string;
  sender: {
    id: number;
    username: string;
    fullName: string;
  } | null;
}

interface ChatUser {
  id: number;
  username: string;
  fullName: string;
  isManager?: boolean;
  teamId?: number;
}

// Schema for creating a new conversation
const newConversationSchema = z.object({
  name: z.string().min(1, "Conversation name is required"),
  isTeamChannel: z.boolean().default(false),
  teamId: z.number().nullable().optional(),
  isChannelType: z.boolean().default(false),
  channelTag: z.string().optional(),
  isPublic: z.boolean().default(false),
  creatorId: z.number().optional(),
});

// Schema for sending a message
const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty"),
  isUrgent: z.boolean().default(false),
  attachmentUrl: z.string().nullable().optional(),
});

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [notificationTarget, setNotificationTarget] = useState<"all" | "mentions" | "urgent" | "none">("all");
  
  // Get chat type from URL query parameters (messages or channels)
  const [location] = useLocation();
  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const chatType = queryParams.get('type') || 'messages';
  
  // Multi-select chat conversations functionality
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isChannelType, setIsChannelType] = useState(chatType === 'channels');
  const [channelTag, setChannelTag] = useState("");
  const [isPublicChannel, setIsPublicChannel] = useState(false);
  
  // WebSocket connection reference
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Form for creating a new conversation
  const newConversationForm = useForm<z.infer<typeof newConversationSchema>>({
    resolver: zodResolver(newConversationSchema),
    defaultValues: {
      name: "",
      isTeamChannel: chatType === 'channels',
      teamId: null,
      isChannelType: chatType === 'channels',
      channelTag: "",
      isPublic: false,
      creatorId: user?.id,
    },
  });

  // Form for adding a participant to a conversation
  const addParticipantForm = useForm<{ userId: string | number; isAdmin: boolean }>({
    defaultValues: {
      userId: "",
      isAdmin: false,
    },
  });

  // Queries for fetching data
  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
    enabled: !!user,
  });

  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: ["/api/chat/conversations", selectedConversation, "participants"],
    enabled: !!selectedConversation,
  });

  const { 
    data: messages, 
    isLoading: messagesLoading 
  } = useQuery<Message[]>({
    queryKey: ["/api/chat/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  });

  // Get team members for adding to conversations
  const { data: teamMembers } = useQuery<ChatUser[]>({
    queryKey: ["/api/teams/members"],
    enabled: !!user,
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: !!user,
    refetchInterval: 10000, // Check for unread messages every 10 seconds
  });

  // Mutations for making changes
  const createConversationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof newConversationSchema>) => {
      const res = await apiRequest("POST", "/api/chat/conversations", data);
      return await res.json();
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setIsNewConversationOpen(false);
      newConversationForm.reset();
      
      // Add selected participants if any
      if (selectedParticipants.length > 0) {
        selectedParticipants.forEach(userId => {
          addParticipantMutation.mutate({
            conversationId: newConversation.id,
            userId,
            isAdmin: false
          });
        });
        
        // Reset selected participants
        setSelectedParticipants([]);
      }
      
      toast({
        title: "Conversation created",
        description: "Your new conversation has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating conversation",
        description: error.message || "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: z.infer<typeof sendMessageSchema> & { conversationId: number }) => {
      const res = await apiRequest(
        "POST",
        `/api/chat/conversations/${data.conversationId}/messages`,
        {
          content: data.content,
          isUrgent: data.isUrgent,
          attachmentUrl: data.attachmentUrl,
        }
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation, "messages"],
      });
      setNewMessage("");
      setIsUrgent(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending message",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (data: { conversationId: number; userId: number; isAdmin: boolean }) => {
      const res = await apiRequest(
        "POST",
        `/api/chat/conversations/${data.conversationId}/participants`,
        {
          userId: data.userId,
          isAdmin: data.isAdmin,
        }
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation, "participants"],
      });
      setIsAddParticipantOpen(false);
      addParticipantForm.reset();
      toast({
        title: "Participant added",
        description: "The participant has been added to the conversation.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding participant",
        description: error.message || "Failed to add participant",
        variant: "destructive",
      });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (data: { conversationId: number; userId: number }) => {
      const res = await apiRequest(
        "DELETE",
        `/api/chat/conversations/${data.conversationId}/participants/${data.userId}`
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation, "participants"],
      });
      toast({
        title: "Participant removed",
        description: "The participant has been removed from the conversation.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing participant",
        description: error.message || "Failed to remove participant",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const res = await apiRequest("DELETE", `/api/chat/messages/${messageId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations", selectedConversation, "messages"],
      });
      toast({
        title: "Message deleted",
        description: "The message has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting message",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    },
  });
  
  // Mutation for deleting conversations (single or multiple)
  const deleteConversationsMutation = useMutation({
    mutationFn: async (conversationIds: number[]) => {
      // Store any errors for conversations that couldn't be deleted
      const errors: { id: number; error: string }[] = [];
      const deletedIds: number[] = [];

      // Delete one by one to ensure each deletion completes
      for (const id of conversationIds) {
        try {
          const conversation = conversations?.find(c => c.id === id);
          
          // Only allow deletion if:
          // 1. It's a direct message (always allowed for participants)
          // 2. User is the creator of a channel
          // 3. User is a manager (has admin rights)
          if (!conversation?.isChannelType || 
              conversation.creatorId === user?.id || 
              user?.isManager) {
            await apiRequest("DELETE", `/api/chat/conversations/${id}`);
            deletedIds.push(id);
          } else {
            errors.push({ 
              id, 
              error: "You don't have permission to delete this channel" 
            });
          }
        } catch (error: any) {
          errors.push({ id, error: error.message || "Failed to delete" });
        }
      }

      return { deletedIds, errors };
    },
    onSuccess: (result) => {
      const { deletedIds, errors } = result;
      
      // Invalidate queries to refresh conversation list
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations"],
      });
      
      // Clear selection state
      setSelectedConversations([]);
      setIsMultiSelectMode(false);
      setIsDeleteDialogOpen(false);
      
      // Reset selected conversation if it was deleted
      if (selectedConversation && deletedIds.some(id => id === selectedConversation)) {
        setSelectedConversation(null);
      }
      
      // Refetch conversations immediately
      queryClient.refetchQueries({
        queryKey: ["/api/chat/conversations"],
      });
      
      // Show success message if any conversations were deleted
      if (deletedIds.length > 0) {
        toast({
          title: "Conversations deleted",
          description: deletedIds.length > 1 
            ? `${deletedIds.length} conversations have been deleted.`
            : "The conversation has been deleted.",
        });
      }
      
      // Show error messages for any conversations that couldn't be deleted
      if (errors.length > 0) {
        errors.forEach(error => {
          toast({
            title: "Deletion error",
            description: error.error,
            variant: "destructive",
          });
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting conversations",
        description: error.message || "Failed to delete conversations",
        variant: "destructive",
      });
    },
  });

  // WebSocket connection setup
  const setupWebSocket = useCallback(() => {
    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    // Determine the WebSocket URL based on the current protocol and host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log("Connecting to WebSocket at:", wsUrl);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    
    socket.onopen = () => {
      console.log("WebSocket connection established");
      setWsConnected(true);
      
      // Authenticate the WebSocket connection with our token
      const authToken = localStorage.getItem("authToken");
      if (authToken) {
        socket.send(JSON.stringify({
          type: "authenticate",
          token: authToken,
          conversationIds: selectedConversation ? [selectedConversation] : []
        }));
      }
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setWsConnected(false);
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (user) {
          setupWebSocket();
        }
      }, 3000);
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsConnected(false);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data.type);
        
        // Handle different message types
        switch (data.type) {
          case "authenticated":
            console.log("WebSocket authenticated as user:", data.userId);
            
            // Subscribe to the selected conversation if any
            if (selectedConversation) {
              socket.send(JSON.stringify({
                type: "subscribe",
                conversationId: selectedConversation
              }));
            }
            break;
            
          case "new_message":
            // If this is a message for our current conversation, add it to the UI
            if (data.message.conversationId === selectedConversation) {
              // Update the messages via React Query
              queryClient.invalidateQueries({
                queryKey: ["/api/chat/conversations", selectedConversation, "messages"],
              });
            } else {
              // Update unread count if the message is for another conversation
              queryClient.invalidateQueries({
                queryKey: ["/api/chat/unread-count"],
              });
            }
            break;
            
          case "error":
            console.error("WebSocket error message:", data.message);
            toast({
              title: "Chat Error",
              description: data.message,
              variant: "destructive",
            });
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    return socket;
  }, [selectedConversation, toast, user]);
  
  // Set up WebSocket connection when component mounts or user changes
  useEffect(() => {
    if (user) {
      const socket = setupWebSocket();
      
      return () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    }
  }, [user, setupWebSocket]);
  
  // Subscribe to selected conversation when it changes
  useEffect(() => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN && selectedConversation) {
      // Subscribe to the newly selected conversation
      socket.send(JSON.stringify({
        type: "subscribe",
        conversationId: selectedConversation
      }));
    }
    
    // Whenever selected conversation changes, explicitly fetch messages
    if (selectedConversation) {
      console.log("Fetching messages for conversation:", selectedConversation);
      const fetchMessages = async () => {
        try {
          const response = await fetch(`/api/chat/conversations/${selectedConversation}/messages`);
          if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          console.log("Messages fetched successfully:", data);
          // Force update messages via queryClient
          queryClient.setQueryData(
            ["/api/chat/conversations", selectedConversation, "messages"], 
            data
          );
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
      };
      fetchMessages();
    }
  }, [selectedConversation, queryClient]);

  // Auto-scroll to the bottom of the messages when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    // Try to send via WebSocket first (faster real-time updates)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsConnected) {
      wsRef.current.send(JSON.stringify({
        type: "chat_message",
        conversationId: selectedConversation,
        content: newMessage,
        isUrgent,
        attachmentUrl: null
      }));
      
      // Clear the input immediately for better UX
      setNewMessage("");
      setIsUrgent(false);
    } else {
      // Fallback to REST API if WebSocket is not available
      sendMessageMutation.mutate({
        conversationId: selectedConversation,
        content: newMessage,
        isUrgent,
        attachmentUrl: null,
      });
    }
  };

  // Handle creating a new conversation
  const onSubmitNewConversation = (data: z.infer<typeof newConversationSchema>) => {
    // Ensure creatorId is set for channel permissions
    if (data.isChannelType && user) {
      data.creatorId = user.id;
    }
    createConversationMutation.mutate(data);
  };

  // Handle adding a participant
  const onSubmitAddParticipant = (data: { userId: string | number; isAdmin: boolean }) => {
    if (!selectedConversation) return;
    
    const userId = typeof data.userId === 'string' && data.userId !== '' 
      ? parseInt(data.userId, 10) 
      : data.userId;
    
    // Only proceed if we have a valid userId (not NaN, not empty string)
    if (!userId) {
      toast({
        title: "Error adding participant",
        description: "Please select a user to add",
        variant: "destructive",
      });
      return;
    }

    addParticipantMutation.mutate({
      conversationId: selectedConversation,
      userId: userId,
      isAdmin: data.isAdmin,
    });
  };

  // Handle removing a participant
  const handleRemoveParticipant = (userId: number) => {
    if (!selectedConversation) return;

    removeParticipantMutation.mutate({
      conversationId: selectedConversation,
      userId,
    });
  };

  // Handle deleting a message
  const handleDeleteMessage = (messageId: number) => {
    deleteMessageMutation.mutate(messageId);
  };

  // Handle toggling a participant in the selection list
  const toggleParticipant = (userId: number) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  // Filter conversations by search term
  const filteredConversations = conversations?.filter(
    (conversation) =>
      conversation.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get the current conversation
  const currentConversation = conversations?.find(
    (conversation) => conversation.id === selectedConversation
  );

  // Separate conversations into direct messages and group chats
  const directMessages = filteredConversations?.filter(c => 
    !c.isTeamChannel && !c.isChannelType && participants?.filter(p => p.conversationId === c.id)?.length === 2
  ) || [];
  
  const groupChats = filteredConversations?.filter(c => 
    !c.isTeamChannel && !c.isChannelType && (!participants?.filter(p => p.conversationId === c.id) || 
    participants?.filter(p => p.conversationId === c.id)?.length > 2)
  ) || [];
  
  const teamChannels = filteredConversations?.filter(c => c.isTeamChannel || c.isChannelType) || [];
  
  // Display all conversation types in one view
  const displayedConversations = [...directMessages, ...groupChats, ...teamChannels];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Unified Chat Header */}
      <div className="px-4 pt-4 mb-2 flex space-x-4 border-b">
        <div className="px-4 py-2 flex items-center border-b-2 border-primary font-semibold text-primary">
          <MessageCircle className="h-4 w-4 mr-2" />
          Chat
        </div>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Conversations Sidebar - Slack-like */}
        <div className="w-full md:w-80 border-r flex flex-col md:h-full h-auto">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Chat</h2>
              <div className="flex items-center space-x-2">
                {unreadCount && unreadCount.count > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">
                    {unreadCount.count}
                  </div>
                )}
                
                {/* Toggle multi-select mode */}
                {isMultiSelectMode ? (
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const allIds = conversations?.map(c => c.id) || [];
                        setSelectedConversations(
                          selectedConversations.length === allIds.length ? [] : allIds
                        );
                      }}
                    >
                      {selectedConversations.length === (conversations?.length || 0) ? 
                        "Deselect All" : "Select All"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={selectedConversations.length === 0}
                    >
                      Delete ({selectedConversations.length})
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setIsMultiSelectMode(false);
                        setSelectedConversations([]);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setIsMultiSelectMode(true)}>
                        Select Multiple
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <PlusCircle className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Conversation</DialogTitle>
                      <DialogDescription>
                        Create a new conversation or channel and add participants
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...newConversationForm}>
                      <form
                        onSubmit={newConversationForm.handleSubmit(onSubmitNewConversation)}
                        className="space-y-4"
                      >
                        <FormField
                          control={newConversationForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Conversation Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter a name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="isChannelType" 
                              checked={isChannelType}
                              onCheckedChange={(checked) => {
                                setIsChannelType(!!checked);
                                newConversationForm.setValue("isChannelType", !!checked);
                              }}
                            />
                            <label 
                              htmlFor="isChannelType"
                              className="text-sm font-medium leading-none"
                            >
                              Create as Channel
                            </label>
                          </div>
                            
                          {isChannelType && (
                            <div className="ml-6 space-y-3 mt-2">
                              <FormField
                                control={newConversationForm.control}
                                name="channelTag"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Channel Tag</FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="E.g. general, sales, support" 
                                        {...field} 
                                        onChange={(e) => {
                                          field.onChange(e);
                                          setChannelTag(e.target.value);
                                        }}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                                
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="isPublicChannel" 
                                  checked={isPublicChannel}
                                  onCheckedChange={(checked) => {
                                    setIsPublicChannel(!!checked);
                                    newConversationForm.setValue("isPublic", !!checked);
                                  }}
                                />
                                <label 
                                  htmlFor="isPublicChannel"
                                  className="text-sm font-medium leading-none"
                                >
                                  Make channel public to team
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <FormLabel>Select Participants</FormLabel>
                          <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                            {teamMembers?.filter(m => m.id !== user?.id).map((member) => (
                              <div key={member.id} className="flex items-center space-x-2 py-1">
                                <Checkbox 
                                  id={`member-${member.id}`} 
                                  checked={selectedParticipants.includes(member.id)}
                                  onCheckedChange={() => toggleParticipant(member.id)}
                                />
                                <label 
                                  htmlFor={`member-${member.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {member.fullName}
                                </label>
                              </div>
                            ))}
                            {(!teamMembers || teamMembers.length <= 1) && (
                              <p className="text-sm text-muted-foreground">No other team members available</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="enableNotifications" 
                            checked={enableNotifications}
                            onCheckedChange={(checked) => setEnableNotifications(!!checked)}
                          />
                          <label 
                            htmlFor="enableNotifications"
                            className="text-sm font-medium leading-none"
                          >
                            Enable notifications for this conversation
                          </label>
                        </div>
                        
                        <DialogFooter>
                          <Button type="submit" disabled={createConversationMutation.isPending}>
                            {createConversationMutation.isPending && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            {isChannelType ? "Create Channel" : "Create Conversation"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {conversationsLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : displayedConversations && displayedConversations.length > 0 ? (
              <div className="py-2">
                {/* Direct Messages Section */}
                {directMessages.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between px-4 py-2">
                      <button className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Direct Messages
                      </button>
                    </div>
                    <div>
                      {directMessages.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`w-full text-left px-4 py-2 hover:bg-accent/50 transition-colors flex items-center ${
                            isMultiSelectMode 
                              ? selectedConversations.includes(conversation.id)
                                ? "bg-accent/70 text-accent-foreground"
                                : ""
                              : selectedConversation === conversation.id 
                                ? "bg-accent text-accent-foreground" 
                                : ""
                          }`}
                          onClick={() => {
                            if (isMultiSelectMode) {
                              setSelectedConversations(prev => 
                                prev.includes(conversation.id)
                                  ? prev.filter(id => id !== conversation.id)
                                  : [...prev, conversation.id]
                              );
                            } else {
                              setSelectedConversation(conversation.id);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setIsMultiSelectMode(true);
                            setSelectedConversations(prev => 
                              prev.includes(conversation.id) 
                                ? prev 
                                : [...prev, conversation.id]
                            );
                          }}
                        >
                          {isMultiSelectMode && (
                            <Checkbox 
                              className="mr-2 h-4 w-4 flex-shrink-0"
                              checked={selectedConversations.includes(conversation.id)}
                              onCheckedChange={(checked) => {
                                setSelectedConversations(prev => 
                                  checked 
                                    ? [...prev, conversation.id]
                                    : prev.filter(id => id !== conversation.id)
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <MessageCircle className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{conversation.name || "Unnamed Conversation"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Group Chats Section */}
                {groupChats.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between px-4 py-2">
                      <button className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Group Chats
                      </button>
                    </div>
                    <div>
                      {groupChats.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`w-full text-left px-4 py-2 hover:bg-accent/50 transition-colors flex items-center ${
                            isMultiSelectMode 
                              ? selectedConversations.includes(conversation.id)
                                ? "bg-accent/70 text-accent-foreground"
                                : ""
                              : selectedConversation === conversation.id 
                                ? "bg-accent text-accent-foreground" 
                                : ""
                          }`}
                          onClick={() => {
                            if (isMultiSelectMode) {
                              setSelectedConversations(prev => 
                                prev.includes(conversation.id)
                                  ? prev.filter(id => id !== conversation.id)
                                  : [...prev, conversation.id]
                              );
                            } else {
                              setSelectedConversation(conversation.id);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setIsMultiSelectMode(true);
                            setSelectedConversations(prev => 
                              prev.includes(conversation.id) 
                                ? prev 
                                : [...prev, conversation.id]
                            );
                          }}
                        >
                          {isMultiSelectMode && (
                            <Checkbox 
                              className="mr-2 h-4 w-4 flex-shrink-0"
                              checked={selectedConversations.includes(conversation.id)}
                              onCheckedChange={(checked) => {
                                setSelectedConversations(prev => 
                                  checked 
                                    ? [...prev, conversation.id]
                                    : prev.filter(id => id !== conversation.id)
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <Users className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{conversation.name || "Unnamed Group"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Team Channels Section */}
                {teamChannels.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between px-4 py-2">
                      <button className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Team Channels
                      </button>
                    </div>
                    <div>
                      {teamChannels.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`w-full text-left px-4 py-2 hover:bg-accent/50 transition-colors flex items-center ${
                            isMultiSelectMode 
                              ? selectedConversations.includes(conversation.id)
                                ? "bg-accent/70 text-accent-foreground"
                                : ""
                              : selectedConversation === conversation.id 
                                ? "bg-accent text-accent-foreground" 
                                : ""
                          }`}
                          onClick={() => {
                            if (isMultiSelectMode) {
                              setSelectedConversations(prev => 
                                prev.includes(conversation.id)
                                  ? prev.filter(id => id !== conversation.id)
                                  : [...prev, conversation.id]
                              );
                            } else {
                              setSelectedConversation(conversation.id);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setIsMultiSelectMode(true);
                            setSelectedConversations(prev => 
                              prev.includes(conversation.id) 
                                ? prev 
                                : [...prev, conversation.id]
                            );
                          }}
                        >
                          {isMultiSelectMode && (
                            <Checkbox 
                              className="mr-2 h-4 w-4 flex-shrink-0"
                              checked={selectedConversations.includes(conversation.id)}
                              onCheckedChange={(checked) => {
                                setSelectedConversations(prev => 
                                  checked 
                                    ? [...prev, conversation.id]
                                    : prev.filter(id => id !== conversation.id)
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <Hash className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{conversation.channelTag || conversation.name || "general"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <p>No conversations found.</p>
                <Button
                  variant="link"
                  className="p-0 h-auto mt-2"
                  onClick={() => setIsNewConversationOpen(true)}
                >
                  Create a new conversation
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-h-[50vh] md:min-h-0">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="text-center space-y-4 max-w-md">
                <h2 className="text-2xl font-bold">Welcome to Chat</h2>
                <p className="text-muted-foreground">
                  Select a conversation from the sidebar or create a new one to start messaging.
                </p>
                <Button
                  onClick={() => setIsNewConversationOpen(true)}
                  className="mt-4"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create New Conversation
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="border-b p-4 flex justify-between items-center">
                <div className="flex items-center">
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback>
                      {currentConversation?.name
                        ? currentConversation.name.substring(0, 2).toUpperCase()
                        : "CH"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold">
                      {currentConversation?.name || "Unnamed Conversation"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {participants?.length || 0} participants
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Bell className="h-4 w-4 mr-1" />
                        Notifications
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuCheckboxItem 
                        checked={notificationTarget === "all"}
                        onCheckedChange={() => setNotificationTarget("all")}
                      >
                        All messages
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem 
                        checked={notificationTarget === "mentions"}
                        onCheckedChange={() => setNotificationTarget("mentions")}
                      >
                        Mentions only
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem 
                        checked={notificationTarget === "urgent"}
                        onCheckedChange={() => setNotificationTarget("urgent")}
                      >
                        Urgent messages only
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem 
                        checked={notificationTarget === "none"}
                        onCheckedChange={() => setNotificationTarget("none")}
                      >
                        None
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                
                  <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add People
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Participant</DialogTitle>
                        <DialogDescription>
                          Add a user to this conversation
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium leading-none" htmlFor="userId">
                            Select User
                          </label>
                          <select
                            id="userId"
                            className="w-full border rounded-md p-2"
                            value={addParticipantForm.watch("userId")}
                            onChange={(e) => addParticipantForm.setValue("userId", e.target.value)}
                          >
                            <option value="">Select a user</option>
                            {teamMembers?.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.fullName} ({member.username})
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="isAdmin"
                            checked={addParticipantForm.watch("isAdmin")}
                            onCheckedChange={(checked) => 
                              addParticipantForm.setValue("isAdmin", !!checked)
                            }
                          />
                          <label htmlFor="isAdmin" className="text-sm font-medium leading-none">
                            Make admin
                          </label>
                        </div>
                        
                        <DialogFooter>
                          <Button 
                            onClick={() => onSubmitAddParticipant({
                              userId: addParticipantForm.getValues("userId"),
                              isAdmin: addParticipantForm.getValues("isAdmin")
                            })}
                            disabled={addParticipantMutation.isPending}
                          >
                            {addParticipantMutation.isPending && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Add
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Messages List with Scroll Area */}
              <ScrollArea className="flex-1 p-4 pb-safe-[120px]">
                {messagesLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Debug message for selected conversation */}
                    <div className="mb-4 p-2 bg-yellow-100 rounded text-xs">
                      <p>Debug Info:</p>
                      <p>Selected Conversation: {selectedConversation}</p>
                      <p>Messages loaded: {messages ? (Array.isArray(messages) ? messages.length : 'Not an array') : 'None'}</p>
                      <pre className="mt-2 overflow-auto max-h-20">
                        {JSON.stringify(messages, null, 2)}
                      </pre>
                    </div>
                    
                    {messages && Array.isArray(messages) && messages.length > 0 ? (
                      <div className="space-y-4">
                        {messages.map((message: Message) => {
                          const isSelf = message.senderId === user?.id;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`flex max-w-[70%] ${
                                  isSelf ? "flex-row-reverse" : "flex-row"
                                }`}
                              >
                                {!isSelf && (
                                  <Avatar className={`h-8 w-8 ${isSelf ? "ml-2" : "mr-2"} flex-shrink-0`}>
                                    <AvatarFallback>
                                      {message.sender?.fullName.substring(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <div>
                                  <div className="flex items-center mb-1">
                                    {!isSelf && (
                                      <span className="text-sm font-semibold mr-2">
                                        {message.sender?.fullName || "Unknown"}
                                      </span>
                                    )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(message.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {message.isUrgent && (
                                  <span title="Urgent message">
                                    <AlertCircle
                                      className="h-4 w-4 text-red-500 ml-1"
                                    />
                                  </span>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      Send Push Notification
                                    </DropdownMenuItem>
                                    {isSelf && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            Delete Message
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Message</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete this message? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteMessage(message.id)}
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div
                                className={`py-2 px-3 rounded-lg ${
                                  isSelf
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                } ${message.isUrgent ? "border-2 border-red-500" : ""}`}
                              >
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                {message.attachmentUrl && (
                                  <a
                                    href={message.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline block mt-1"
                                  >
                                    View Attachment
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="text-center p-4 text-muted-foreground h-full flex items-center justify-center">
                    <p>No messages yet. Be the first to send a message!</p>
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Type your message here..."
                      className="resize-none min-h-[80px]"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="urgent"
                          checked={isUrgent}
                          onCheckedChange={(checked) => setIsUrgent(!!checked)}
                        />
                        <label htmlFor="urgent" className="text-sm font-medium leading-none">
                          Mark as urgent
                        </label>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Push Notifications
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Notify</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Everyone in this chat</DropdownMenuItem>
                          <DropdownMenuItem>Specific people...</DropdownMenuItem>
                          <DropdownMenuItem>No one</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Button
                    className="self-start"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" />
                    )}
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Participants Sidebar (only shown when a conversation is selected) */}
        {selectedConversation && (
          <div className="w-64 border-l hidden md:block">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-2">Participants</h3>
              {participantsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <div className="space-y-3 pr-3">
                    {participants?.map((participant) => (
                      <div key={participant.id} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback>
                              {participant.user?.fullName.substring(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate max-w-[120px]">
                            {participant.user?.fullName}
                            {participant.isAdmin && (
                              <span className="text-xs ml-1 text-muted-foreground">(Admin)</span>
                            )}
                          </span>
                        </div>
                        {/* Only admins or the current user (for themselves) can remove participants */}
                        {(participants?.some(
                          (p) => p.userId === user?.id && p.isAdmin
                        ) ||
                          user?.id === participant.userId) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Participant</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this participant from the conversation?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveParticipant(participant.userId)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Conversations Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedConversations.length > 1 ? "Conversations" : "Conversation"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedConversations.length > 1 
                ? `${selectedConversations.length} conversations` 
                : "this conversation"}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConversationsMutation.mutate(selectedConversations)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteConversationsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}