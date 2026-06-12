import React from 'react';

interface Props {
  title: string;
}

export const Card = ({ title }: Props): JSX.Element => <div className="card">{title}</div>;

export class Widget extends React.Component<Props> {
  private count = 0;

  render(): JSX.Element {
    return <span>{this.props.title}</span>;
  }
}
