import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/api/customers';
import { CreateCustomerPayload } from '@/types/customer';

export function useCustomers() {
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: customersApi.getCustomers,
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: CreateCustomerPayload) => customersApi.createCustomer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCustomerPayload> }) =>
      customersApi.updateCustomer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerLedger'] });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => customersApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const bulkCreateCustomerMutation = useMutation({
    mutationFn: (customers: CreateCustomerPayload[]) => customersApi.bulkCreateCustomers(customers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return {
    customers: customersQuery.data || [],
    isLoading: customersQuery.isLoading,
    refetch: customersQuery.refetch,
    createCustomer: createCustomerMutation.mutateAsync,
    isCreating: createCustomerMutation.isPending,
    updateCustomer: updateCustomerMutation.mutateAsync,
    deleteCustomer: deleteCustomerMutation.mutateAsync,
    bulkCreateCustomers: bulkCreateCustomerMutation.mutateAsync,
    isBulkCreating: bulkCreateCustomerMutation.isPending,
  };
}

