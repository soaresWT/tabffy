pub fn split_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut chars = sql.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '\'' => {
                current.push(ch);
                while let Some(c) = chars.next() {
                    current.push(c);
                    if c == '\'' {
                        if chars.peek() == Some(&'\'') {
                            current.push(chars.next().unwrap());
                        } else {
                            break;
                        }
                    }
                }
            }
            '"' => {
                current.push(ch);
                while let Some(c) = chars.next() {
                    current.push(c);
                    if c == '"' {
                        break;
                    }
                }
            }
            '-' if chars.peek() == Some(&'-') => {
                chars.next();
                while let Some(c) = chars.next() {
                    if c == '\n' {
                        current.push(' ');
                        break;
                    }
                }
            }
            ';' => {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    statements.push(trimmed.to_string());
                }
                current.clear();
            }
            _ => {
                current.push(ch);
            }
        }
    }

    let trimmed = current.trim();
    if !trimmed.is_empty() {
        statements.push(trimmed.to_string());
    }

    statements
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_statement() {
        let result = split_statements("SELECT 1");
        assert_eq!(result, vec!["SELECT 1"]);
    }

    #[test]
    fn test_multiple_statements() {
        let result = split_statements("SELECT 1; SELECT 2;");
        assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn test_semicolon_in_string() {
        let result = split_statements("INSERT INTO t VALUES ('a;b')");
        assert_eq!(result, vec!["INSERT INTO t VALUES ('a;b')"]);
    }

    #[test]
    fn test_semicolon_in_double_quotes() {
        let result = split_statements("SELECT \"col;name\" FROM t");
        assert_eq!(result, vec!["SELECT \"col;name\" FROM t"]);
    }

    #[test]
    fn test_escaped_single_quote() {
        let result = split_statements("INSERT INTO t VALUES ('it''s;ok')");
        assert_eq!(result, vec!["INSERT INTO t VALUES ('it''s;ok')"]);
    }

    #[test]
    fn test_line_comment() {
        let result = split_statements("SELECT 1 -- comment\nFROM t; SELECT 2");
        assert_eq!(result, vec!["SELECT 1  FROM t", "SELECT 2"]);
    }

    #[test]
    fn test_trailing_semicolons() {
        let result = split_statements("SELECT 1;; SELECT 2;;");
        assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn test_whitespace_only() {
        let result = split_statements("  ;  ;  ");
        assert!(result.is_empty());
    }

    #[test]
    fn test_create_and_insert() {
        let sql = "CREATE TABLE t (id INT PRIMARY KEY);
                   INSERT INTO t VALUES (1), (2), (3);";
        let result = split_statements(sql);
        assert_eq!(result.len(), 2);
        assert!(result[0].starts_with("CREATE"));
        assert!(result[1].starts_with("INSERT"));
    }
}
