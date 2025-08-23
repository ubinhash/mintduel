'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PreparePlayerMoveData } from '@/types';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useEffect } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Gamepad2,
  Loader2,
  Shield,
  XCircle,
} from 'lucide-react';

interface PlayerMoveTransactionHandlerProps {
  transaction: PreparePlayerMoveData;
  onComplete: (hash: string) => void;
  onError: (error: string) => void;
}

export function PlayerMoveTransactionHandler({
  transaction,
  onComplete,
  onError,
}: PlayerMoveTransactionHandlerProps) {
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
            },
            {
              internalType: "enum OtomDuel.PlayerAction",
              name: "action",
              type: "uint8"
            },
            {
              internalType: "uint256",
              name: "otomIndex",
              type: "uint256"
            }
          ],
          name: "playerPlay",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function"
        }
      ],
      functionName: 'playerPlay',
      args: [
        BigInt(transaction.metadata.gameId),
        transaction.metadata.actionValue as number,
        BigInt(transaction.metadata.otomIndex)
      ],
      // No ETH value needed for player move
    });
  };

  const getStatusMessage = () => {
    if (writeError) return 'Transaction failed';
    if (isConfirmed) return 'Move completed successfully!';
    if (isWaitingForReceipt) return 'Confirming move...';
    if (isSuccess) return 'Move submitted!';
    if (isPending) return 'Signing move...';
    return 'Ready to make your move';
  };

  const getStatusIcon = () => {
    if (writeError) return XCircle;
    if (isConfirmed) return CheckCircle;
    if (isWaitingForReceipt || isPending) return Loader2;
    if (isSuccess) return CheckCircle;
    return Gamepad2;
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
          <Gamepad2 className="h-5 w-5" />
          Player Move
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
            <span className="text-muted-foreground">Action:</span>
            <Badge variant="outline" className="capitalize">
              {transaction.metadata.action}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">OTOM Index:</span>
            <span>{transaction.metadata.otomIndex}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">OTOM Mass:</span>
            <span>{transaction.metadata.otomMass}</span>
          </div>
        </div>

        <Separator />

        {/* Game Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Game Status</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Round:</span>
              <span className="ml-1">{transaction.gameStatus.currentRound + 1}/3</span>
            </div>
            <div>
              <span className="text-muted-foreground">Agent Health:</span>
              <span className="ml-1">{transaction.gameStatus.agentHealth}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Charge:</span>
              <span className="ml-1">{transaction.gameStatus.accumulatedCharge}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Stake:</span>
              <span className="ml-1">{transaction.gameStatus.stakeAmount} ETH</span>
            </div>
          </div>
        </div>

        {/* Available OTOMs */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Available OTOMs</h4>
          <div className="flex gap-1">
            {transaction.otomDetails.availableOtomIndices.map((index) => (
              <Badge
                key={index}
                variant={index === transaction.metadata.otomIndex ? "default" : "outline"}
                className="text-xs"
              >
                {index} ({transaction.otomDetails.otomMasses[index]})
              </Badge>
            ))}
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
        {!isSuccess && !writeError && (
          <Button
            onClick={handleSendTransaction}
            disabled={isPending || isWaitingForReceipt}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing Move...
              </>
            ) : isWaitingForReceipt ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Move Submitted!
              </>
            ) : (
              <>
                <Gamepad2 className="mr-2 h-4 w-4" />
                Make Move
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
                Move submitted successfully! Waiting for confirmation...
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
              Failed to submit move: {writeError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Next Steps:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            {transaction.instructions.nextSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 