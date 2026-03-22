'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, type CrmLead } from '@/lib/api';
import { CrmKanban } from '@/components/crm/kanban-board';
import { useToast } from '@/hooks/use-toast';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['leads'],
    queryFn: leadsApi.getAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CrmLead> }) =>
      leadsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Success',
        description: 'Lead updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lead',
        variant: 'destructive',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Success',
        description: 'Lead created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create lead',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete lead',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading leads...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-destructive">Error loading leads. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CrmKanban
        leads={leads}
        onUpdateLead={async (id, updates) => {
          await updateMutation.mutateAsync({ id, updates });
        }}
        onCreateLead={async (lead) => {
          await createMutation.mutateAsync(lead);
        }}
        onDeleteLead={async (id) => {
          await deleteMutation.mutateAsync(id);
        }}
      />
    </div>
  );
}
