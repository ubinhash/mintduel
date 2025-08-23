'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PrepareStartGameData, PrepareApproveOtomData } from '@/types';
import { CheckCircle, ExternalLink, Loader2, Wallet, XCircle, Gamepad2, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { ApproveOtomTransactionHandler } from './approve-otom-transaction-handler';

type StartGameTransactionHandlerProps = {
  transaction: PrepareStartGameData;
  onComplete?: (hash: string) => void;
  onError?: (error: string) => void;
};

export function StartGameTransactionHandler({
  transaction,
  onComplete,
  onError,
}: StartGameTransactionHandlerProps) {
  const { address, isConnected } = useAccount();
  const [storedHash, setStoredHash] = useState<string | undefined>();
  const [needsApproval, setNeedsApproval] = useState<boolean>(true);
  const [approvalTransaction, setApprovalTransaction] = useState<PrepareApproveOtomData | null>(null);
  const [approvalCompleted, setApprovalCompleted] = useState<boolean>(false);

  const { writeContract, isPending, error: writeError, data: hash } = useWriteContract();

  // Check approval status
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: '0xc709F59f1356230025d4fdFDCeD92341A14FF2F8' as `0x${string}`, // OTOM contract address
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "account",
            type: "address"
          },
          {
            internalType: "address",
            name: "operator",
            type: "address"
          }
        ],
        name: "isApprovedForAll",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: 'isApprovedForAll',
    args: [address as `0x${string}`, transaction.metadata.contractAddress as `0x${string}`],
    query: {
      enabled: !!address && !!transaction.metadata.contractAddress,
    },
  });

  // Update approval status when data changes
  useEffect(() => {
    if (isApproved !== undefined) {
      setNeedsApproval(!isApproved);
    }
  }, [isApproved]);

  // Create approval transaction when needed
  useEffect(() => {
    if (needsApproval && !approvalTransaction && address) {
      const approvalData: PrepareApproveOtomData = {
        success: true,
        transaction: {
          to: '0xc709F59f1356230025d4fdFDCeD92341A14FF2F8', // OTOM contract
          data: '', // Will be set by the approval handler
          value: '0x0',
        },
        metadata: {
          otomContractAddress: '0xc709F59f1356230025d4fdFDCeD92341A14FF2F8',
          functionName: 'setApprovalForAll',
          playerAddress: address,
          operatorAddress: transaction.metadata.contractAddress,
          approved: true,
          estimatedGas: '50000',
          chainId: 11011,
          explorerUrl: 'https://sepolia.shapescan.xyz/address/0xc709F59f1356230025d4fdFDCeD92341A14FF2F8',
        },
        instructions: {
          nextSteps: [
            'Use your wallet to execute this approval transaction',
            'This allows the OtomDuel contract to transfer your OTOM tokens',
            'After approval, you can start the game',
            'Check the transaction on Shape Sepolia explorer',
          ],
        },
      };
      setApprovalTransaction(approvalData);
    }
  }, [needsApproval, approvalTransaction, address, transaction.metadata.contractAddress]);

  // Store the hash when we get it to prevent it from being lost
  useEffect(() => {
    if (hash && !storedHash) {
      console.log('🔗 Storing transaction hash:', hash);
      setStoredHash(hash);
    }
  }, [hash]);

  // Approval handlers
  const handleApprovalComplete = useCallback((hash: string) => {
    console.log('Approval completed:', hash);
    setApprovalCompleted(true);
    setNeedsApproval(false);
    // Refetch approval status
    refetchApproval();
  }, [refetchApproval]);

  const handleApprovalError = useCallback((error: string) => {
    console.error('Approval failed:', error);
    // Don't clear the transaction, let user retry
  }, []);

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
      console.log('🎉 Start game transaction successful! Hash:', finalHash);
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

    console.log('🚀 Sending start game transaction:', {
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
              internalType: "uint256[]",
              name: "otomIds",
              type: "uint256[]"
            }
          ],
          name: "startGame",
          outputs: [],
          stateMutability: "payable",
          type: "function"
        }
      ],
      functionName: 'startGame',
      args: [transaction.metadata.otomIds.map(id => BigInt(id))],
      value: BigInt(transaction.transaction.value),
    });
  };

  const getStatusMessage = () => {
    if (isSuccess) return 'Game started successfully!';
    if (writeError || receiptError) return 'Transaction failed';
    if (isWaitingForReceipt) return 'Confirming transaction...';
    if (isPending) return 'Signing transaction...';
    return 'Ready to start game';
  };

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (writeError || receiptError) return <XCircle className="h-4 w-4 text-red-500" />;
    if (isWaitingForReceipt) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (isPending) return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    return <Gamepad2 className="h-4 w-4" />;
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
          <Gamepad2 className="h-5 w-5" />
          Start OtomDuel Game
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transaction Details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stake Amount:</span>
            <span className="font-mono">{transaction.metadata.stakeAmount} ETH</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">OTOMs:</span>
            <span className="font-mono">{transaction.metadata.otomNames.join(', ')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated Gas:</span>
            <span className="font-mono">{transaction.metadata.estimatedGas}</span>
          </div>
        </div>

        {/* Approval Status */}
        <div className="flex items-center gap-2">
          {needsApproval ? (
            <>
              <Shield className="h-4 w-4 text-yellow-500" />
              <Badge className="bg-yellow-100 text-yellow-800">Approval Required</Badge>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <Badge className="bg-green-100 text-green-800">OTOMs Approved</Badge>
            </>
          )}
        </div>

        {/* Show Approval Handler if needed */}
        {needsApproval && approvalTransaction && (
          <div className="border-t pt-4">
            <ApproveOtomTransactionHandler
              transaction={approvalTransaction}
              onComplete={handleApprovalComplete}
              onError={handleApprovalError}
            />
          </div>
        )}

        {/* Show Start Game Handler if approved */}
        {!needsApproval && (
          <>
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
                  Your OtomDuel game has been started successfully! The agent will now commit their first move.
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
                      <Wallet className="mr-2 h-4 w-4" />
                      Start Game
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
                  Please check your wallet to sign the transaction
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
                      <div className="font-semibold">⏳ Transaction Submitted!</div>
                      <div className="text-sm">
                        Your transaction is being confirmed on Shape Sepolia...
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
          </>
        )}
      </CardContent>
    </Card>
  );
} 