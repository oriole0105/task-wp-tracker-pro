import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box, Typography, Paper, Divider,
  Table, TableHead, TableBody, TableRow, TableCell,
  Chip,
} from '@mui/material';
import manualContent from '../../../../USER_MANUAL_modify.md?raw';

const HelpPage: React.FC = () => {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
                {children}
              </Typography>
            ),
            h2: ({ children }) => (
              <>
                <Divider sx={{ mt: 4, mb: 1 }} />
                <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 3, mb: 1, fontWeight: 700, color: 'primary.main' }}>
                  {children}
                </Typography>
              </>
            ),
            h3: ({ children }) => (
              <Typography variant="h6" component="h3" gutterBottom sx={{ mt: 2.5, mb: 0.5, fontWeight: 600 }}>
                {children}
              </Typography>
            ),
            h4: ({ children }) => (
              <Typography variant="subtitle1" component="h4" gutterBottom sx={{ mt: 2, mb: 0.5, fontWeight: 600 }}>
                {children}
              </Typography>
            ),
            p: ({ children }) => (
              <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                {children}
              </Typography>
            ),
            ul: ({ children }) => (
              <Box component="ul" sx={{ pl: 3, mb: 1.5, '& li': { mb: 0.5 } }}>
                {children}
              </Box>
            ),
            ol: ({ children }) => (
              <Box component="ol" sx={{ pl: 3, mb: 1.5, '& li': { mb: 0.5 } }}>
                {children}
              </Box>
            ),
            li: ({ children }) => (
              <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
                {children}
              </Typography>
            ),
            blockquote: ({ children }) => (
              <Box sx={{
                borderLeft: 4, borderColor: 'primary.main', pl: 2, ml: 0, my: 2,
                bgcolor: 'action.hover', borderRadius: '0 4px 4px 0', py: 1,
              }}>
                {children}
              </Box>
            ),
            code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
              inline ? (
                <Box
                  component="code"
                  sx={{
                    bgcolor: 'action.selected', px: 0.6, py: 0.2, borderRadius: 0.5,
                    fontFamily: 'monospace', fontSize: '0.875em',
                  }}
                  {...props}
                >
                  {children}
                </Box>
              ) : (
                <Box
                  component="pre"
                  sx={{
                    bgcolor: 'action.hover', p: 2, borderRadius: 1, overflow: 'auto',
                    fontFamily: 'monospace', fontSize: '0.85rem', my: 1.5,
                    border: '1px solid', borderColor: 'divider',
                  }}
                >
                  <code>{children}</code>
                </Box>
              ),
            table: ({ children }) => (
              <Box sx={{ overflowX: 'auto', my: 2 }}>
                <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
                  {children}
                </Table>
              </Box>
            ),
            thead: ({ children }) => <TableHead>{children}</TableHead>,
            tbody: ({ children }) => <TableBody>{children}</TableBody>,
            tr: ({ children }) => <TableRow hover>{children}</TableRow>,
            th: ({ children }) => (
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                {children}
              </TableCell>
            ),
            td: ({ children }) => (
              <TableCell sx={{ verticalAlign: 'top' }}>
                {children}
              </TableCell>
            ),
            hr: () => <Divider sx={{ my: 3 }} />,
            strong: ({ children }) => (
              <Box component="strong" sx={{ fontWeight: 700 }}>{children}</Box>
            ),
            a: ({ href, children }) => (
              <Box
                component="a"
                href={href}
                sx={{ color: 'primary.main', textDecoration: 'underline', '&:hover': { opacity: 0.8 } }}
              >
                {children}
              </Box>
            ),
            // 版本 chip 顯示（引言 blockquote 內的版本資訊）
            em: ({ children }) => (
              <Box component="em" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>{children}</Box>
            ),
          }}
        >
          {manualContent}
        </ReactMarkdown>
        <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label="WorkScope Planner" size="small" color="primary" variant="outlined" />
          <Chip label="使用者手冊" size="small" variant="outlined" />
        </Box>
      </Paper>
    </Box>
  );
};

export default HelpPage;
