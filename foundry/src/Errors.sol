// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

error Unauthorized();
error InsufficientDeposit();
error InvalidAgent();
error EscrowNotFound();
error AlreadyExists();
error InvalidSignature(address signer, bytes32 signedHash);
error InvalidAddress();
error InvalidBytes32();
error RevokedAddress();
error ReentrancyGuarded();
error TransferFailed();
error InvalidAmount();
error InvalidEnclaveHash();
error MilestoneAlreadyApproved();
error MilestoneNotApproved();
error MilestoneAlreadyClaimed();
error MilestoneNotFound();
