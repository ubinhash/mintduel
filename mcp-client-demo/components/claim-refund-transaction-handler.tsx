'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PrepareClaimRefundData } from '@/types';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useEffect } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';

interface ClaimRefundTransactionHandlerProps {
  transaction: PrepareClaimRefundData;
  onComplete: (hash: string) => void;
  onError: (error: string) => void;
}

export function ClaimRefundTransactionHandler({
  transaction,
  onComplete,
  onError,
}: ClaimRefundTransactionHandlerProps) {
  const { address, isConnected } = useAccount();

  const { writeContract, isPending, isSuccess, error: writeError, data: transactionHash } = useWriteContract();

  const { isLoading: isWaitingForReceipt, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: transactionHash,
    });

  const handleSendTransaction = () => {
    if (!isConnected || !address) {
      onError('Please connect your wallet first');
      return;
    }

    writeContract({
      address: transaction.transaction.to as `0x${string}`,
      abi: [
        {
          inputs: [
            {
              internalType: "uint256",
              name: "gameId",
              type: "uint256"
            }
          ],
          name: "claimRefund",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function"
        }
      ],
      functionName: 'claimRefund',
      args: [BigInt(transaction.metadata.gameId)],
      // No ETH value needed for claim refund
    });
  };

  const getStatusMessage = () => {
    if (writeError) return 'Transaction failed';
    if (isConfirmed) return 'Refund claimed and NFT minted successfully!';
    if (isWaitingForReceipt) return 'Confirming refund claim and NFT mint...';
    if (isSuccess) return 'Refund claim and NFT mint submitted!';
    if (isPending) return 'Signing refund claim and NFT mint...';
    return 'Ready to claim your mint price discount and mint NFT';
  };

  const getStatusIcon = () => {
    if (writeError) return XCircle;
    if (isConfirmed) return CheckCircle;
    if (isWaitingForReceipt || isPending) return Loader2;
    if (isSuccess) return CheckCircle;
    return Wallet;
  };

  const getStatusColor = () => {
    if (writeError) return 'text-red-500';
    if (isConfirmed) return 'text-green-500';
    if (isWaitingForReceipt || isPending) return 'text-blue-500';
    if (isSuccess) return 'text-green-500';
    return 'text-blue-500';
  };

  const StatusIcon = getStatusIcon();

  // Handle completion and errors with useEffect to prevent infinite re-renders
  useEffect(() => {
    if (isConfirmed && transactionHash) {
      onComplete(transactionHash);
    }
  }, [isConfirmed, transactionHash, onComplete]);

  useEffect(() => {
    if (writeError) {
      onError(writeError.message);
    }
  }, [writeError, onError]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
                     <CardTitle className="flex items-center gap-2">
               <Wallet className="h-5 w-5" />
               Claim Refund and Mint NFT
             </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-4 w-4', getStatusColor())} />
          <span className="text-sm font-medium">{getStatusMessage()}</span>
        </div>

        {/* Game Details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Game ID:</span>
            <span className="font-mono">{transaction.metadata.gameId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Refund Amount:</span>
            <Badge variant="outline" className="text-green-600">
              {transaction.metadata.refundAmount} ETH
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Original Stake:</span>
            <span>{transaction.metadata.stakeAmount} ETH</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Agent Health:</span>
            <span>{transaction.metadata.agentHealth}/100</span>
          </div>
        </div>

        <Separator />

        {/* Game Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Game Status</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Round:</span>
              <span className="ml-1">{transaction.gameStatus.currentRound}/3</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className="ml-1">{transaction.gameStatus.gameState === 2 ? 'Completed' : 'Unknown'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Refund Claimed:</span>
              <span className="ml-1">{transaction.gameStatus.refundClaimed ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Stake:</span>
              <span className="ml-1">{transaction.gameStatus.stakeAmount} ETH</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Transaction Details */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Transaction Details</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract:</span>
              <span className="font-mono truncate max-w-[200px]">
                {transaction.metadata.contractAddress}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Gas:</span>
              <span>{transaction.metadata.estimatedGas}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {!isSuccess && !writeError && !isConfirmed && (
          <Button
            onClick={handleSendTransaction}
            disabled={isPending || isWaitingForReceipt}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing Claim and Mint...
              </>
            ) : isWaitingForReceipt ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claim and Mint Submitted!
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Claim and Mint
              </>
            )}
          </Button>
        )}

        {/* Success State */}
        {isSuccess && (
          <div className="space-y-2">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Refund claim and NFT mint submitted successfully! Waiting for confirmation...
              </AlertDescription>
            </Alert>
            {transactionHash && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(transaction.metadata.explorerUrl, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Explorer
              </Button>
            )}
          </div>
        )}

        {/* Error State */}
        {writeError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to claim refund and mint NFT: {writeError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Next Steps:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            {transaction.instructions.nextSteps.map((step: string, index: number) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 