'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PrepareApproveOtomData } from '@/types';
import { CheckCircle, ExternalLink, Loader2, Wallet, XCircle, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

type ApproveOtomTransactionHandlerProps = {
  transaction: PrepareApproveOtomData;
  onComplete?: (hash: string) => void;
  onError?: (error: string) => void;
};

export function ApproveOtomTransactionHandler({
  transaction,
  onComplete,
  onError,
}: ApproveOtomTransactionHandlerProps) {
  const { address, isConnected } = useAccount();
  const [storedHash, setStoredHash] = useState<string | undefined>();

  const { writeContract, isPending, error: writeError, data: hash } = useWriteContract();

  // Store the hash when we get it to prevent it from being lost
  useEffect(() => {
    if (hash && !storedHash) {
      console.log('🔗 Storing approval transaction hash:', hash);
      setStoredHash(hash);
    }
  }, [hash]);

  // Use stored hash for receipt monitoring
  const finalHash = storedHash || hash;

  const {
    data: receipt,
    isSuccess,
    isError: receiptError,
    isPending: isWaitingForReceipt,
    error: receiptErrorDetails,
  } = useWaitForTransactionReceipt({
    hash: finalHash as `0x${string}`,
    timeout: 120_000, // 2 minute timeout
  });

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && receipt && finalHash) {
      console.log('🎉 OTOM approval successful! Hash:', finalHash);
      onComplete?.(finalHash);
    }
  }, [isSuccess, receipt, finalHash]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError);
      onError?.(writeError.message);
    }
  }, [writeError]);

  // Handle receipt errors
  useEffect(() => {
    if (receiptError && receiptErrorDetails) {
      console.error('Receipt error:', receiptErrorDetails);
      onError?.(receiptErrorDetails.message || 'Transaction failed - please try again');
    }
  }, [receiptError, receiptErrorDetails]);

  // Fallback timeout for stuck transactions
  useEffect(() => {
    if (hash && isWaitingForReceipt) {
      const timeoutId = setTimeout(() => {
        console.log('Transaction timeout - still waiting after 3 minutes');
        // Don't auto-fail it, but log it for debugging
      }, 180_000); // 3 minutes

      return () => clearTimeout(timeoutId);
    }
  }, [hash, isWaitingForReceipt]);

  const handleSendTransaction = () => {
    if (!isConnected || !address) {
      onError?.('Wallet not connected');
      return;
    }

    console.log('🚀 Sending OTOM approval transaction:', {
      to: transaction.transaction.to,
      data: transaction.transaction.data,
      value: transaction.transaction.value,
    });

    writeContract({
      address: transaction.transaction.to as `0x${string}`,
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "operator",
              type: "address"
            },
            {
              internalType: "bool",
              name: "approved",
              type: "bool"
            }
          ],
          name: "setApprovalForAll",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function"
        }
      ],
      functionName: 'setApprovalForAll',
      args: [transaction.metadata.operatorAddress as `0x${string}`, true],
    });
  };

  const getStatusMessage = () => {
    if (isSuccess) return 'OTOMs approved successfully!';
    if (writeError || receiptError) return 'Approval failed';
    if (isWaitingForReceipt) return 'Confirming approval...';
    if (isPending) return 'Signing approval...';
    return 'Ready to approve OTOMs';
  };

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (writeError || receiptError) return <XCircle className="h-4 w-4 text-red-500" />;
    if (isWaitingForReceipt) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (isPending) return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    return <Shield className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (isSuccess) return 'bg-green-100 text-green-800';
    if (writeError || receiptError) return 'bg-red-100 text-red-800';
    if (isWaitingForReceipt) return 'bg-blue-100 text-blue-800';
    if (isPending) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Approve OTOM Transfers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transaction Details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">OTOM Contract:</span>
            <span className="font-mono text-xs">
              {transaction.metadata.otomContractAddress.slice(0, 6)}...
              {transaction.metadata.otomContractAddress.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Operator:</span>
            <span className="font-mono text-xs">
              {transaction.metadata.operatorAddress.slice(0, 6)}...
              {transaction.metadata.operatorAddress.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated Gas:</span>
            <span className="font-mono">{transaction.metadata.estimatedGas}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Badge className={getStatusColor()}>{getStatusMessage()}</Badge>
        </div>

        {/* Error Display */}
        {(writeError || receiptError) && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {writeError?.message || receiptErrorDetails?.message || 'Transaction failed'}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {isSuccess && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your OTOMs are now approved! You can proceed to start the game.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isSuccess && !writeError && (
            <Button
              onClick={handleSendTransaction}
              disabled={!isConnected || isPending}
              className="flex-1"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Approve OTOMs
                </>
              )}
            </Button>
          )}

          {/* View on Explorer */}
          {finalHash && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(transaction.metadata.explorerUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Next Steps:</strong></p>
          {transaction.instructions.nextSteps.map((step, index) => (
            <p key={index}>• {step}</p>
          ))}
        </div>

        {/* Transaction Pending States */}
        {isPending && (
          <div className="space-y-2 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-yellow-500" />
            <p className="text-muted-foreground text-sm">
              Please check your wallet to sign the approval
            </p>
          </div>
        )}

        {/* Waiting for confirmation */}
        {finalHash && isWaitingForReceipt && !isSuccess && (
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="space-y-2">
                  <div className="font-semibold">⏳ Approval Submitted!</div>
                  <div className="text-sm">
                    Your approval is being confirmed on Shape Sepolia...
                  </div>
                  <a
                    href={`https://sepolia.shapescan.xyz/tx/${finalHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    View Pending Transaction
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 