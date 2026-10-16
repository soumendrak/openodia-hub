use strict;
use warnings;
my $defs = q~
  (?(DEFINE)
    (?<T>`(?:[^`\\\\\$]|\\\\.|\$(?!\{)|\$\{(?&I)\})*`)
    (?<I>(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|(?&T)|[^{}"'`]|\{(?&I)\})*)
  )
~;
my $lit = qr{("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|((?&T))$defs}xs;
my $ins = qr{\\.|\$\{((?&I))\}$defs}xs;
sub blank {
  my ($s) = @_;
  $s =~ s/$lit/defined $1 ? '""' : defined $2 ? "''" : tpl($3)/ge;
  return $s;
}
sub tpl {
  my ($t) = @_;
  my $n = ($t =~ tr/\n//);
  my $body = substr($t, 1, -1);
  my @parts;
  while ($body =~ /$ins/g) { push @parts, blank($1) =~ s/\s+/ /gr if defined $1; }
  return "`" . join(" ", @parts) . "`" . ("\n+" x $n);
}
local $/;
my $src = <STDIN>;
print blank($src);
