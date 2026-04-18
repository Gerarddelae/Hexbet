#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092}"

echo "Waiting for Kafka at ${BOOTSTRAP_SERVERS}..."
until kafka-broker-api-versions --bootstrap-server "${BOOTSTRAP_SERVERS}" >/dev/null 2>&1; do
  sleep 2
done

echo "Creating Kafka topics..."
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVERS}" --create --if-not-exists --topic match.events --partitions 6 --replication-factor 1
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVERS}" --create --if-not-exists --topic odds.updated --partitions 6 --replication-factor 1
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVERS}" --create --if-not-exists --topic bet.placed --partitions 12 --replication-factor 1
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVERS}" --create --if-not-exists --topic bet.settled --partitions 6 --replication-factor 1
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVERS}" --create --if-not-exists --topic bet.placed.dlq --partitions 3 --replication-factor 1

echo "Kafka topics ready:"
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVERS}" --list | sort
