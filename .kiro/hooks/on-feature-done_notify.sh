#!/bin/bash
# Hook: on_feature_done — imprime resumen del feature completado
echo "Feature completed: ${FEATURE_ID:-?} — ${FEATURE_NAME:-?}"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Agent: ${AGENT_NAME:-unknown}"
echo ""
echo "TODO: integrate with Slack, Jira, or notification system"
