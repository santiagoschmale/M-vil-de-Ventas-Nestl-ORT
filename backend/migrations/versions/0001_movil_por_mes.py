"""Un móvil por mes: las acciones del planner y los archivos que subió.

Revision ID: 0001
Revises:
"""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("movil", sa.Column("mes", sa.String(7), primary_key=True))
    op.create_table(
        "comando",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("mes", sa.String(7), sa.ForeignKey("movil.mes"), nullable=False),
        sa.Column("metodo", sa.String(40), nullable=False),
        sa.Column("args", sa.JSON, nullable=False),
    )
    op.create_index("ix_comando_mes", "comando", ["mes"])
    op.create_table(
        "archivo",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("contenido", sa.LargeBinary, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("archivo")
    op.drop_index("ix_comando_mes", "comando")
    op.drop_table("comando")
    op.drop_table("movil")
