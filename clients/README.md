# Client Workspaces

This directory contains client-specific workspaces for consulting projects. Each client gets their own isolated directory for documents, notes, and project files.

## Structure

```
clients/
├── client-name/
│   ├── documents/      # Contracts, SOWs, invoices
│   ├── interactions/   # Meeting notes, emails, chat logs
│   ├── deliverables/   # Code, reports, presentations
│   ├── research/       # Background research, references
│   └── .env.local      # Client-specific configuration
└── _template/          # Template for new clients
```

## Creating a New Client Workspace

1. Copy the template:
   ```bash
   cp -r clients/_template clients/new-client-name
   ```

2. Update the client info in `clients/new-client-name/CLIENT_INFO.md`

3. Add any client-specific environment variables to `.env.local`

## Privacy & Security

- **All client directories are git-ignored** except this README and the template
- Never commit actual client data to the repository
- Use encryption for sensitive documents
- Consider using cloud storage with proper access controls for document backup

## Best Practices

1. **Naming Convention**: Use lowercase with hyphens (e.g., `acme-corp`, `startup-xyz`)
2. **Documentation**: Keep detailed notes in `interactions/` for all client communications
3. **Invoicing**: Track time and deliverables in `documents/invoices/`
4. **Archiving**: When a project ends, zip and move to cold storage

## Integration Points

While client data stays local, you can:
- Track interactions in the main database using the client name as a reference
- Use the dashboard to view aggregated metrics without exposing client details
- Build agents that work with client data while respecting boundaries